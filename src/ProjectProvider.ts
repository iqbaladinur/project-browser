import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const projectFolderIcon = vscode.Uri.file(path.join(__dirname, '..', 'images', 'project-folder.svg'));
const projectGitIcon = vscode.Uri.file(path.join(__dirname, '..', 'images', 'project-git.svg'));

export type ProjectNameOverrides = Record<string, string>;

export type CollapsedBaseFolders = string[];

export type ProjectIconId = 'folder' | 'repo' | 'star' | 'rocket' | 'database' | 'package' | 'tools' | 'mobile';

export interface ProjectCustomization {
  icon?: ProjectIconId;
  color?: string;
}

export type ProjectCustomizations = Record<string, ProjectCustomization>;

const defaultFolderColor = '#c5c5c5';
const defaultGitColor = '#6a9955';

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
    isCollapsed: boolean = false,
    iconPath?: vscode.Uri
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
      this.iconPath = iconPath || getProjectIconPath(entry);
      this.command = {
        command: 'projectBrowser.openProject',
        title: 'Open Project',
        arguments: [this],
      };
    }
  }
}

function sanitizeSvgValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9#._-]/g, '');
}

function getIconGlyph(icon: ProjectIconId): string {
  switch (icon) {
    case 'star':
      return '<path d="M8 5.05l1 2 2.2.32-1.6 1.55.38 2.18L8 10.08 6.02 11.1l.38-2.18-1.6-1.55L7 7.05l1-2z" fill="#ffffff"/>';
    case 'rocket':
      return '<path d="M8.9 5.3c.95-.85 2.08-1.16 3.14-1.06.1 1.06-.21 2.19-1.06 3.14L9 9.35l-2.08-2.08L8.9 5.3zM6.3 8l2.15 2.15-1.16 1.16-1.55-.6-.6-1.55L6.3 8zM5.36 11.05l-1.26 1.26.39-1.66.87.4z" fill="#ffffff"/>';
    case 'database':
      return '<ellipse cx="8" cy="6.15" rx="3.4" ry="1.25" fill="#ffffff"/><path d="M4.6 6.15v4.35c0 .7 1.52 1.25 3.4 1.25s3.4-.55 3.4-1.25V6.15c0 .7-1.52 1.25-3.4 1.25s-3.4-.55-3.4-1.25zm0 2.15c0 .7 1.52 1.25 3.4 1.25s3.4-.55 3.4-1.25" fill="#ffffff"/>';
    case 'package':
      return '<path d="M8 4.55l3.45 1.75v4.25L8 12.3l-3.45-1.75V6.3L8 4.55zm0 1.08L5.72 6.78 8 7.9l2.28-1.12L8 5.63zM5.55 7.7v2.28l1.98 1V8.7L5.55 7.7zm2.92 3.28l1.98-1V7.7l-1.98 1v2.28z" fill="#ffffff"/>';
    case 'tools':
      return '<path d="M6.5 10.45l3.12-3.12a1.82 1.82 0 0 0 2.18-2.35l-1.3 1.3-.84-.84 1.3-1.3A1.82 1.82 0 0 0 8.6 6.31L5.48 9.43l1.02 1.02zM5.05 9.85l1.55 1.55-1.16 1.16a1.1 1.1 0 0 1-1.55-1.55l1.16-1.16z" fill="#ffffff"/>';
    case 'mobile':
      return '<rect x="5.65" y="4.3" width="4.7" height="8.2" rx=".9" fill="#ffffff"/><rect x="6.55" y="5.35" width="2.9" height="5.5" rx=".25" fill="none" stroke="#1e1e1e" stroke-width=".55"/><circle cx="8" cy="11.75" r=".28" fill="#1e1e1e"/>';
    case 'repo':
      return '<path d="M5.5 7.5v2.15m0 0a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zm0 0h4a1.15 1.15 0 0 0 1.15-1.15v-1m0 0a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3z" stroke="#ffffff" stroke-width="1.15" stroke-linecap="round"/>';
    case 'folder':
    default:
      return '';
  }
}

function getCustomizedIconPath(
  entry: ProjectEntry,
  customization: ProjectCustomization,
  iconStoragePath: string
): vscode.Uri {
  const icon = customization.icon || (entry.isGit ? 'repo' : 'folder');
  const color = sanitizeSvgValue(customization.color || (entry.isGit ? defaultGitColor : defaultFolderColor));
  const fileName = `${icon}-${color.replace('#', '')}-v3.svg`;
  const filePath = path.join(iconStoragePath, fileName);

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(iconStoragePath, { recursive: true });
    const background = `<path d="M1 3.25c0-.42.33-.75.75-.75h4.2c.26 0 .5.13.64.35l.78 1.15h6.88c.42 0 .75.33.75.75v7.75c0 .55-.45 1-1 1H2c-.55 0-1-.45-1-1V3.25z" fill="${color}"/>`;
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">',
      background,
      getIconGlyph(icon),
      '</svg>',
    ].join('');
    fs.writeFileSync(filePath, svg, 'utf8');
  }

  return vscode.Uri.file(filePath);
}

export function getProjectIconPath(
  entry: ProjectEntry,
  customization?: ProjectCustomization,
  iconStoragePath?: string
): vscode.Uri {
  if (customization && iconStoragePath && (customization.icon || customization.color)) {
    return getCustomizedIconPath(entry, customization, iconStoragePath);
  }

  return entry.isGit ? projectGitIcon : projectFolderIcon;
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
    private readonly getCollapsedBaseFolders: () => CollapsedBaseFolders = () => [],
    private readonly getProjectCustomizations: () => ProjectCustomizations = () => ({}),
    private readonly iconStoragePath?: string
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
    const projectCustomizations = this.getProjectCustomizations();

    if (baseFolders.length === 0) {
      return [];
    }

    // Single base folder: flat list of projects
    if (baseFolders.length === 1 && !element) {
      let projects = readProjects(baseFolders[0], projectNames);
      if (!showNonGit) projects = projects.filter((p) => p.isGit);
      return sortProjects(projects, gitFirst).map((p) => new ProjectItem(
        p,
        false,
        false,
        getProjectIconPath(p, projectCustomizations[p.fullPath], this.iconStoragePath)
      ));
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
      return sortProjects(projects, gitFirst).map((p) => new ProjectItem(
        p,
        false,
        false,
        getProjectIconPath(p, projectCustomizations[p.fullPath], this.iconStoragePath)
      ));
    }

    return [];
  }
}
