import * as vscode from 'vscode';
import * as path from 'path';
import {
  ProjectItem,
  ProjectNameOverrides,
  ProjectProvider,
  getAllProjects,
} from './ProjectProvider';

const projectNamesKey = 'projectBrowser.projectNames';
const collapsedBaseFoldersKey = 'projectBrowser.collapsedBaseFolders';

export function activate(context: vscode.ExtensionContext) {
  const getProjectNames = () => context.globalState.get<ProjectNameOverrides>(projectNamesKey, {});
  const updateProjectNames = (projectNames: ProjectNameOverrides) =>
    context.globalState.update(projectNamesKey, projectNames);
  const getCollapsedBaseFolders = () =>
    context.globalState.get<string[]>(collapsedBaseFoldersKey, []);
  const updateCollapsedBaseFolders = (collapsedBaseFolders: string[]) =>
    context.globalState.update(collapsedBaseFoldersKey, collapsedBaseFolders);

  const provider = new ProjectProvider(getProjectNames, getCollapsedBaseFolders);
  const projectFolderIcon = vscode.Uri.joinPath(context.extensionUri, 'images', 'project-folder.svg');
  const projectGitIcon = vscode.Uri.joinPath(context.extensionUri, 'images', 'project-git.svg');

  const treeView = vscode.window.createTreeView('projectBrowser.projects', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    treeView.onDidCollapseElement(async ({ element }) => {
      if (!element.isBaseFolder) {
        return;
      }

      const collapsedBaseFolders = new Set(getCollapsedBaseFolders());
      collapsedBaseFolders.add(element.entry.fullPath);
      await updateCollapsedBaseFolders([...collapsedBaseFolders]);
    })
  );

  context.subscriptions.push(
    treeView.onDidExpandElement(async ({ element }) => {
      if (!element.isBaseFolder) {
        return;
      }

      const collapsedBaseFolders = new Set(getCollapsedBaseFolders());
      collapsedBaseFolders.delete(element.entry.fullPath);
      await updateCollapsedBaseFolders([...collapsedBaseFolders]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.refresh', () => {
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.search', async () => {
      const projects = getAllProjects(getProjectNames());

      if (projects.length === 0) {
        vscode.window.showInformationMessage(
          'No projects found. Configure projectBrowser.baseFolders in settings.'
        );
        return;
      }

      const items = projects.map((p) => ({
        label: p.displayName,
        iconPath: p.isGit ? projectGitIcon : projectFolderIcon,
        description: p.fullPath,
        detail: p.displayName === p.name
          ? (p.isGit ? 'git repository' : undefined)
          : `Folder: ${p.name}${p.isGit ? ' · git repository' : ''}`,
        projectPath: p.fullPath,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Search and open project...',
        matchOnDescription: true,
        matchOnDetail: false,
      });

      if (selected) {
        const openNewWindow = await vscode.window.showQuickPick(
          [
            { label: '$(window) Open in current window', value: false },
            { label: '$(empty-window) Open in new window', value: true },
          ],
          { placeHolder: selected.label }
        );
        if (openNewWindow !== undefined) {
          vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(selected.projectPath),
            openNewWindow.value
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.openProject', (item: ProjectItem) => {
      vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(item.entry.fullPath),
        false
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.openProjectNewWindow', (item: ProjectItem) => {
      vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(item.entry.fullPath),
        true
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.copyRelativePath', async (item: ProjectItem) => {
      const relativePath = path.relative(item.entry.baseFolder, item.entry.fullPath) || item.entry.name;
      await vscode.env.clipboard.writeText(relativePath);
      vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.copyPath', async (item: ProjectItem) => {
      await vscode.env.clipboard.writeText(item.entry.fullPath);
      vscode.window.showInformationMessage(`Copied path: ${item.entry.fullPath}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.openInNewTerminal', (item: ProjectItem) => {
      const terminal = vscode.window.createTerminal({
        name: item.entry.displayName,
        cwd: item.entry.fullPath,
      });
      terminal.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.revealInExplorer', (item: ProjectItem) => {
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.entry.fullPath));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.renameProject', async (item: ProjectItem) => {
      const displayName = await vscode.window.showInputBox({
        title: 'Rename Project Display Name',
        prompt: 'This changes the Project Browser label only. The folder name stays unchanged.',
        value: item.entry.displayName,
        valueSelection: [0, item.entry.displayName.length],
        validateInput: (value) => value.trim().length === 0 ? 'Name cannot be empty.' : undefined,
      });

      if (displayName === undefined) {
        return;
      }

      const trimmed = displayName.trim();
      const projectNames = { ...getProjectNames() };
      if (trimmed === item.entry.name) {
        delete projectNames[item.entry.fullPath];
      } else {
        projectNames[item.entry.fullPath] = trimmed;
      }

      await updateProjectNames(projectNames);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.resetProjectName', async (item: ProjectItem) => {
      const projectNames = { ...getProjectNames() };
      delete projectNames[item.entry.fullPath];
      await updateProjectNames(projectNames);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.addBaseFolder', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Add as Base Folder',
      });

      if (uris && uris.length > 0) {
        const config = vscode.workspace.getConfiguration('projectBrowser');
        const current: string[] = config.get('baseFolders', []);
        const newPath = uris[0].fsPath;
        if (!current.includes(newPath)) {
          await config.update(
            'baseFolders',
            [...current, newPath],
            vscode.ConfigurationTarget.Global
          );
          provider.refresh();
          vscode.window.showInformationMessage(`Added base folder: ${newPath}`);
        }
      }
    })
  );

  // Show setup message if no base folders configured
  const config = vscode.workspace.getConfiguration('projectBrowser');
  const baseFolders: string[] = config.get('baseFolders', []);
  if (baseFolders.length === 0) {
    vscode.window.showInformationMessage(
      'Project Browser: No base folders configured.',
      'Add Base Folder'
    ).then((action) => {
      if (action === 'Add Base Folder') {
        vscode.commands.executeCommand('projectBrowser.addBaseFolder');
      }
    });
  }
}

export function deactivate() {}
