import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectItem, ProjectProvider, getAllProjects } from './ProjectProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ProjectProvider();
  const projectFolderIcon = vscode.Uri.joinPath(context.extensionUri, 'images', 'project-folder.svg');
  const projectGitIcon = vscode.Uri.joinPath(context.extensionUri, 'images', 'project-git.svg');

  const treeView = vscode.window.createTreeView('projectBrowser.projects', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.refresh', () => {
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('projectBrowser.search', async () => {
      const projects = getAllProjects();

      if (projects.length === 0) {
        vscode.window.showInformationMessage(
          'No projects found. Configure projectBrowser.baseFolders in settings.'
        );
        return;
      }

      const items = projects.map((p) => ({
        label: p.name,
        iconPath: p.isGit ? projectGitIcon : projectFolderIcon,
        description: p.fullPath,
        detail: p.isGit ? 'git repository' : undefined,
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
        name: item.entry.name,
        cwd: item.entry.fullPath,
      });
      terminal.show();
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
