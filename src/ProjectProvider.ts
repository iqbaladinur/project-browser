import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const projectFolderIcon = vscode.Uri.file(path.join(__dirname, '..', 'images', 'project-folder.svg'));
const projectGitIcon = vscode.Uri.file(path.join(__dirname, '..', 'images', 'project-git.svg'));

export type ProjectNameOverrides = Record<string, string>;

export type CollapsedBaseFolders = string[];

export interface ProjectEntry {
  name: string;
  displayName: string;
  fullPath: string;
  isGit: boolean;
  baseFolder: string;
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly entry: ProjectEntry,
    public readonly isBaseFolder: boolean = false,
    isCollapsed: boolean = false
  ) {
    super(
      entry.displayName,
      isBaseFolder
        ? (isCollapsed
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded)
        : vscode.TreeItemCollapsibleState.None
    );

    if (isBaseFolder) {
      this.contextValue = 'baseFolder';
      this.iconPath = new vscode.ThemeIcon('folder-opened');
      this.tooltip = entry.fullPath;
    } else {
      this.contextValue = 'project';
      this.tooltip = entry.displayName === entry.name
        ? entry.fullPath
        : `${entry.displayName}\nFolder: ${entry.name}\n${entry.fullPath}`;
      this.description = entry.isGit ? 'git' : undefined;
      this.iconPath = entry.isGit ? projectGitIcon : projectFolderIcon;
      this.command = {
        command: 'projectBrowser.openProject',
        title: 'Open Project',
        arguments: [this],
      };
    }
  }
}

function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function readProjects(baseFolder: string, projectNames: ProjectNameOverrides = {}): ProjectEntry[] {
  const expanded = expandPath(baseFolder);
  try {
    const entries = fs.readdirSync(expanded, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => {
        const fullPath = path.join(expanded, e.name);
        const isGit = fs.existsSync(path.join(fullPath, '.git'));
        const displayName = projectNames[fullPath] || e.name;
        return { name: e.name, displayName, fullPath, isGit, baseFolder: expanded };
      });
  } catch {
    return [];
  }
}

function sortProjects(projects: ProjectEntry[], gitFirst: boolean): ProjectEntry[] {
  return [...projects].sort((a, b) => {
    if (gitFirst) {
      if (a.isGit && !b.isGit) return -1;
      if (!a.isGit && b.isGit) return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

export function getAllProjects(projectNames: ProjectNameOverrides = {}): ProjectEntry[] {
  const config = vscode.workspace.getConfiguration('projectBrowser');
  const baseFolders: string[] = config.get('baseFolders', []);
  const showNonGit: boolean = config.get('showNonGitFolders', true);
  const gitFirst: boolean = config.get('gitReposFirst', true);

  const all: ProjectEntry[] = [];
  for (const base of baseFolders) {
    let projects = readProjects(base, projectNames);
    if (!showNonGit) projects = projects.filter((p) => p.isGit);
    all.push(...projects);
  }
  return sortProjects(all, gitFirst);
}

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly getProjectNames: () => ProjectNameOverrides = () => ({}),
    private readonly getCollapsedBaseFolders: () => CollapsedBaseFolders = () => []
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): ProjectItem[] {
    const config = vscode.workspace.getConfiguration('projectBrowser');
    const baseFolders: string[] = config.get('baseFolders', []);
    const showNonGit: boolean = config.get('showNonGitFolders', true);
    const gitFirst: boolean = config.get('gitReposFirst', true);
    const projectNames = this.getProjectNames();
    const collapsedBaseFolders = new Set(this.getCollapsedBaseFolders());

    if (baseFolders.length === 0) {
      return [];
    }

    // Single base folder: flat list of projects
    if (baseFolders.length === 1 && !element) {
      let projects = readProjects(baseFolders[0], projectNames);
      if (!showNonGit) projects = projects.filter((p) => p.isGit);
      return sortProjects(projects, gitFirst).map((p) => new ProjectItem(p));
    }

    // Multiple base folders: group by base folder
    if (!element) {
      return baseFolders.map((base) => {
        const expanded = expandPath(base);
        const name = path.basename(expanded);
        return new ProjectItem(
          { name, displayName: name, fullPath: expanded, isGit: false, baseFolder: expanded },
          true,
          collapsedBaseFolders.has(expanded)
        );
      });
    }

    if (element.isBaseFolder) {
      let projects = readProjects(element.entry.fullPath, projectNames);
      if (!showNonGit) projects = projects.filter((p) => p.isGit);
      return sortProjects(projects, gitFirst).map((p) => new ProjectItem(p));
    }

    return [];
  }
}
