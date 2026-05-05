type ContentMode = 'empty' | 'text' | 'image';
type FileKind = 'text' | 'image' | 'unsupported';

type FileSystemAccessPermissionMode = 'read' | 'readwrite';

interface FileSystemAccessPermissionOptions {
	mode?: FileSystemAccessPermissionMode;
}

type DemoFileHandle = Omit<FileSystemFileHandle, 'createWritable'> & {
	createWritable?(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
	queryPermission?(options?: FileSystemAccessPermissionOptions): Promise<PermissionState>;
	requestPermission?(options?: FileSystemAccessPermissionOptions): Promise<PermissionState>;
};

type DemoHandle = DemoFileHandle | DemoDirectoryHandle;

type DemoDirectoryHandle = FileSystemDirectoryHandle;

interface DemoWindow extends Window {
	showDirectoryPicker?: (options?: { mode?: FileSystemAccessPermissionMode }) => Promise<DemoDirectoryHandle>;
	FileSystemFileHandle?: { prototype: FileSystemFileHandle };
}

interface BaseTreeNode {
	depth: number;
	id: string;
	name: string;
	path: string;
}

interface DirectoryTreeNode extends BaseTreeNode {
	children: TreeNode[];
	handle: DemoDirectoryHandle;
	isLoaded: boolean;
	isLoading: boolean;
	isSkipped: boolean;
	isTruncated: boolean;
	kind: 'directory';
}

interface FileTreeNode extends BaseTreeNode {
	fileKind: FileKind;
	handle: DemoFileHandle;
	kind: 'file';
}

type TreeNode = DirectoryTreeNode | FileTreeNode;

const textExtensions = new Set([
	'js',
	'jsx',
	'ts',
	'tsx',
	'd.ts',
	'mjs',
	'cjs',
	'json',
	'jsonc',
	'html',
	'htm',
	'css',
	'scss',
	'sass',
	'less',
	'vue',
	'svelte',
	'astro',
	'txt',
	'md',
	'mdx',
	'yml',
	'yaml',
	'toml',
	'xml',
	'env',
	'gitignore',
	'cs',
	'py',
	'go'
]);

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const skippedDirectoryNames = new Set([
	'.astro',
	'.git',
	'.next',
	'build',
	'coverage',
	'dist',
	'node_modules'
]);
const maxDirectoryDepth = 5;
const maxEntriesPerDirectory = 160;

const fsWindow = window as DemoWindow;

const elements = {
	activeFileName: document.getElementById('activeFileName'),
	directoryLabel: document.getElementById('directoryLabel'),
	dirtyBadge: document.getElementById('dirtyBadge'),
	editor: document.getElementById('editor') as HTMLTextAreaElement | null,
	emptyState: document.getElementById('emptyState'),
	fileCountLabel: document.getElementById('fileCountLabel'),
	fileMetaText: document.getElementById('fileMetaText'),
	fileTree: document.getElementById('fileTree'),
	imagePreview: document.getElementById('imagePreview'),
	openDirectoryButton: document.getElementById('openDirectoryButton') as HTMLButtonElement | null,
	permissionBadge: document.getElementById('permissionBadge'),
	permissionText: document.getElementById('permissionText'),
	previewImage: document.getElementById('previewImage') as HTMLImageElement | null,
	saveButton: document.getElementById('saveButton') as HTMLButtonElement | null,
	statusText: document.getElementById('statusText'),
	supportBadge: document.getElementById('supportBadge'),
	writeWarning: document.getElementById('writeWarning')
};

const support = {
	createWritable:
		typeof fsWindow.FileSystemFileHandle !== 'undefined' &&
		'createWritable' in fsWindow.FileSystemFileHandle.prototype,
	showDirectoryPicker: typeof fsWindow.showDirectoryPicker === 'function'
};

const state = {
	activeEntryId: null as string | null,
	activeFileHandle: null as DemoFileHandle | null,
	activeFileKind: 'empty' as ContentMode,
	activeFileName: '',
	activeFileText: '',
	activeImageUrl: null as string | null,
	expandedDirectoryIds: new Set<string>(),
	isDirty: false,
	isReadingDirectory: false,
	treeNodes: [] as TreeNode[]
};

const formatBytes = (bytes: number) => {
	if (!Number.isFinite(bytes)) {
		return '';
	}

	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getExtension = (name: string) => {
	const lowerName = name.toLowerCase();

	if (lowerName.endsWith('.d.ts')) {
		return 'd.ts';
	}

	if (lowerName === '.env' || lowerName.endsWith('.env')) {
		return 'env';
	}

	if (lowerName === '.gitignore' || lowerName.endsWith('.gitignore')) {
		return 'gitignore';
	}

	const parts = lowerName.split('.');
	return parts.length > 1 ? parts.at(-1) ?? '' : '';
};

const getFileKind = (name: string): FileKind => {
	const extension = getExtension(name);

	if (textExtensions.has(extension)) {
		return 'text';
	}

	if (imageExtensions.has(extension)) {
		return 'image';
	}

	return 'unsupported';
};

const flattenNodes = (nodes: TreeNode[], expandedDirectoryIds: Set<string>): TreeNode[] => {
	const result: TreeNode[] = [];

	for (const node of nodes) {
		result.push(node);

		if (node.kind === 'directory' && expandedDirectoryIds.has(node.id)) {
			result.push(...flattenNodes(node.children, expandedDirectoryIds));
		}
	}

	return result;
};

const countFiles = (nodes: TreeNode[]): number =>
	nodes.reduce((count, node) => count + (node.kind === 'file' ? 1 : countFiles(node.children)), 0);

const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
	for (const node of nodes) {
		if (node.id === id) {
			return node;
		}

		if (node.kind === 'directory') {
			const nestedNode = findNodeById(node.children, id);

			if (nestedNode) {
				return nestedNode;
			}
		}
	}

	return null;
};

const sortDirectoryEntries = (entries: Array<{ handle: DemoHandle; name: string }>) =>
	entries.sort((a, b) => {
		if (a.handle.kind !== b.handle.kind) {
			return a.handle.kind === 'directory' ? -1 : 1;
		}

		return a.name.localeCompare(b.name, 'ru');
	});

const createDirectoryNode = (
	handle: DemoDirectoryHandle,
	name: string,
	path: string,
	depth: number
): DirectoryTreeNode => {
	const isSkipped = skippedDirectoryNames.has(name) || depth >= maxDirectoryDepth;

	return {
		children: [],
		depth,
		handle,
		id: path,
		isLoaded: isSkipped,
		isLoading: false,
		isSkipped,
		isTruncated: false,
		kind: 'directory',
		name,
		path
	};
};

const readDirectoryChildren = async (
	directoryHandle: DemoDirectoryHandle,
	parentPath = '',
	depth = 0
) => {
	const entries: Array<{ handle: DemoHandle; name: string }> = [];
	let isTruncated = false;

	for await (const [name, handle] of directoryHandle.entries()) {
		entries.push({
			handle:
				handle.kind === 'directory'
					? (handle as DemoDirectoryHandle)
					: (handle as DemoFileHandle),
			name
		});

		if (entries.length >= maxEntriesPerDirectory) {
			isTruncated = true;
			break;
		}
	}

	const nodes = sortDirectoryEntries(entries).map<TreeNode>(({ handle, name }) => {
		const path = parentPath ? `${parentPath}/${name}` : name;

		if (handle.kind === 'directory') {
			return createDirectoryNode(handle, name, path, depth);
		}

		return {
			depth,
			fileKind: getFileKind(name),
			handle,
			id: path,
			kind: 'file',
			name,
			path
		};
	});

	return { isTruncated, nodes };
};

const revokeActiveImageUrl = () => {
	if (state.activeImageUrl) {
		URL.revokeObjectURL(state.activeImageUrl);
		state.activeImageUrl = null;
	}

	if (elements.previewImage) {
		elements.previewImage.removeAttribute('src');
		elements.previewImage.alt = '';
	}
};

const setStatus = (message: string) => {
	if (elements.statusText) {
		elements.statusText.textContent = message;
	}
};

const setBadge = (text: string, className: string) => {
	if (!elements.permissionBadge) {
		return;
	}

	elements.permissionBadge.textContent = text;
	elements.permissionBadge.className = className;
};

const updateSaveButton = () => {
	if (!elements.saveButton) {
		return;
	}

	const isTextFileOpen = state.activeFileKind === 'text';
	elements.saveButton.classList.toggle('hidden', !isTextFileOpen);
	elements.saveButton.disabled =
		state.isReadingDirectory || !state.activeFileHandle || !state.isDirty || !isTextFileOpen;
};

const setReadingDirectory = (isReading: boolean) => {
	state.isReadingDirectory = isReading;

	if (elements.openDirectoryButton) {
		elements.openDirectoryButton.disabled = isReading || !support.showDirectoryPicker;
		elements.openDirectoryButton.textContent = isReading ? 'Сканирую папку...' : 'Открыть папку';
	}

	updateSaveButton();
};

const setDirty = (isDirty: boolean) => {
	state.isDirty = isDirty;
	elements.dirtyBadge?.classList.toggle('hidden', !isDirty);
	elements.writeWarning?.classList.toggle('hidden', !isDirty || state.activeFileKind !== 'text');
	updateSaveButton();
};

const setContentMode = (mode: ContentMode) => {
	state.activeFileKind = mode;

	elements.emptyState?.classList.toggle('hidden', mode !== 'empty');
	elements.emptyState?.classList.toggle('flex', mode === 'empty');

	if (elements.editor) {
		elements.editor.classList.toggle('hidden', mode !== 'text');
		elements.editor.disabled = mode !== 'text';
	}

	elements.imagePreview?.classList.toggle('hidden', mode !== 'image');

	if (mode !== 'image') {
		revokeActiveImageUrl();
	}

	if (mode !== 'text') {
		setDirty(false);
	}

	updateSaveButton();
};

const updatePermissionUi = async () => {
	if (!elements.permissionText) {
		return;
	}

	if (state.activeFileKind === 'image') {
		setBadge('preview', 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600');
		elements.permissionText.textContent =
			'Изображение открыто только для просмотра. Доступ readwrite для preview не нужен.';
		return;
	}

	if (!state.activeFileHandle) {
		setBadge('unknown', 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600');
		elements.permissionText.textContent =
			'Откройте текстовый файл, чтобы проверить право на запись. Запрос появится при сохранении.';
		return;
	}

	if (!state.activeFileHandle.queryPermission) {
		setBadge('unknown', 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800');
		elements.permissionText.textContent =
			'Браузер не умеет заранее проверять права. Попробуем запросить запись при сохранении.';
		return;
	}

	try {
		const permission = await state.activeFileHandle.queryPermission({ mode: 'readwrite' });
		setBadge(
			permission,
			permission === 'granted'
				? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800'
				: permission === 'prompt'
					? 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800'
					: 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800'
		);
		elements.permissionText.textContent =
			permission === 'granted'
				? 'Можно сохранять изменения в текущий файл.'
				: 'При сохранении браузер попросит право readwrite для текущего файла.';
	} catch (error) {
		setBadge('error', 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800');
		elements.permissionText.textContent =
			error instanceof Error ? error.message : 'Не удалось проверить права доступа.';
	}
};

const confirmDiscardChanges = () => {
	if (!state.isDirty || state.activeFileKind !== 'text') {
		return true;
	}

	return window.confirm(
		'В текущем файле есть несохранённые изменения. Потерять их и открыть другой файл?'
	);
};

const getEntryLabel = (entry: TreeNode, isExpanded: boolean) => {
	if (entry.kind === 'directory') {
		if (entry.isLoading) {
			return '...';
		}

		return isExpanded ? '-' : '+';
	}

	if (entry.fileKind === 'text') {
		return 'TXT';
	}

	if (entry.fileKind === 'image') {
		return 'IMG';
	}

	return '---';
};

const getEntryHint = (entry: TreeNode) => {
	if (entry.kind === 'file') {
		return '';
	}

	if (entry.isSkipped) {
		return skippedDirectoryNames.has(entry.name)
			? ' пропущено'
			: ` глубже ${maxDirectoryDepth} уровней`;
	}

	if (entry.isTruncated) {
		return ` первые ${maxEntriesPerDirectory}`;
	}

	return '';
};

const renderFileTree = () => {
	if (!elements.fileTree || !elements.fileCountLabel) {
		return;
	}

	elements.fileCountLabel.textContent = String(countFiles(state.treeNodes));

	if (state.treeNodes.length === 0) {
		const empty = document.createElement('div');
		empty.className =
			'rounded-xl border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500';
		empty.textContent = 'В выбранной папке нет файлов на доступной глубине.';
		elements.fileTree.replaceChildren(empty);
		return;
	}

	elements.fileTree.replaceChildren(
		...flattenNodes(state.treeNodes, state.expandedDirectoryIds).map((entry) => {
			const isDirectory = entry.kind === 'directory';
			const isExpanded = isDirectory && state.expandedDirectoryIds.has(entry.id);
			const isSupportedFile = entry.kind === 'file' && entry.fileKind !== 'unsupported';
			const row = document.createElement('button');
			row.type = 'button';
			row.dataset.entryId = entry.id;
			row.disabled =
				(entry.kind === 'file' && !isSupportedFile) || (isDirectory && entry.isSkipped);
			row.className = [
				'flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition',
				isDirectory
					? 'font-bold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400'
					: entry.fileKind === 'text'
						? 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
						: entry.fileKind === 'image'
							? 'text-slate-700 hover:bg-sky-50 hover:text-sky-900'
							: 'cursor-not-allowed text-slate-400',
				state.activeEntryId === entry.id ? 'bg-emerald-100 text-emerald-950' : ''
			].join(' ');
			row.style.paddingLeft = `${8 + entry.depth * 18}px`;
			row.setAttribute('aria-expanded', isDirectory ? String(isExpanded) : 'false');

			const label = document.createElement('span');
			label.className = [
				'flex h-5 w-8 shrink-0 items-center justify-center rounded text-[0.65rem] font-bold',
				isDirectory
					? 'bg-amber-100 text-amber-800'
					: entry.fileKind === 'text'
						? 'bg-emerald-100 text-emerald-800'
						: entry.fileKind === 'image'
							? 'bg-sky-100 text-sky-800'
							: 'bg-slate-100 text-slate-400'
			].join(' ');
			label.textContent = getEntryLabel(entry, isExpanded);

			const name = document.createElement('span');
			name.className = 'min-w-0 flex-1 truncate';
			name.textContent = `${entry.name}${getEntryHint(entry)}`;

			row.append(label, name);
			return row;
		})
	);
};

const renderFileTreeLoading = () => {
	if (!elements.fileTree || !elements.fileCountLabel) {
		return;
	}

	elements.fileCountLabel.textContent = '...';

	const loading = document.createElement('div');
	loading.className =
		'rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900';
	loading.textContent = 'Сканирую верхний уровень папки...';
	elements.fileTree.replaceChildren(loading);
};

const resetActiveFile = () => {
	state.activeEntryId = null;
	state.activeFileHandle = null;
	state.activeFileName = '';
	state.activeFileText = '';

	if (elements.activeFileName) {
		elements.activeFileName.textContent = 'Ничего не открыто';
	}

	if (elements.editor) {
		elements.editor.value = '';
	}

	if (elements.fileMetaText) {
		elements.fileMetaText.textContent = 'Откройте текстовый файл или изображение из дерева';
	}

	setContentMode('empty');
	setDirty(false);
};

const openTextFile = async (entry: FileTreeNode, file: File) => {
	const text = await file.text();
	state.activeFileText = text;

	if (elements.editor) {
		elements.editor.value = text;
	}

	setContentMode('text');
	setDirty(false);
	await updatePermissionUi();
	setStatus(`Открыт ${entry.path}`);
};

const openImageFile = async (entry: FileTreeNode, file: File) => {
	revokeActiveImageUrl();
	const imageUrl = URL.createObjectURL(file);
	state.activeImageUrl = imageUrl;

	if (elements.previewImage) {
		elements.previewImage.src = imageUrl;
		elements.previewImage.alt = entry.name;
	}

	setContentMode('image');
	await updatePermissionUi();
	setStatus(`Открыто изображение ${entry.path}`);
};

const openFileEntry = async (entry: FileTreeNode) => {
	if (state.isReadingDirectory || entry.fileKind === 'unsupported' || !confirmDiscardChanges()) {
		return;
	}

	try {
		const file = await entry.handle.getFile();
		state.activeEntryId = entry.id;
		state.activeFileHandle = entry.handle;
		state.activeFileName = entry.path;

		if (elements.activeFileName) {
			elements.activeFileName.textContent = entry.path;
		}

		if (elements.fileMetaText) {
			elements.fileMetaText.textContent = `${formatBytes(file.size)} · ${
				file.type || (entry.fileKind === 'image' ? 'image/*' : 'text/plain')
			}`;
		}

		if (entry.fileKind === 'image') {
			await openImageFile(entry, file);
		} else {
			await openTextFile(entry, file);
		}

		renderFileTree();
	} catch (error) {
		setStatus(error instanceof Error ? error.message : 'Не удалось открыть файл.');
	}
};

const loadDirectoryNode = async (entry: DirectoryTreeNode) => {
	if (entry.isLoaded || entry.isLoading || entry.isSkipped) {
		return;
	}

	entry.isLoading = true;
	renderFileTree();

	try {
		const { isTruncated, nodes } = await readDirectoryChildren(
			entry.handle,
			entry.path,
			entry.depth + 1
		);
		entry.children = nodes;
		entry.isLoaded = true;
		entry.isTruncated = isTruncated;
		setStatus(
			isTruncated
				? `Показаны первые ${maxEntriesPerDirectory} элементов в ${entry.path}.`
				: `Папка ${entry.path} раскрыта.`
		);
	} catch (error) {
		setStatus(error instanceof Error ? error.message : 'Не удалось прочитать папку.');
	} finally {
		entry.isLoading = false;
		renderFileTree();
	}
};

const toggleDirectoryEntry = async (entry: DirectoryTreeNode) => {
	if (entry.isSkipped) {
		return;
	}

	if (state.expandedDirectoryIds.has(entry.id)) {
		state.expandedDirectoryIds.delete(entry.id);
		renderFileTree();
		return;
	}

	await loadDirectoryNode(entry);
	state.expandedDirectoryIds.add(entry.id);
	renderFileTree();
};

const openDirectory = async () => {
	if (!support.showDirectoryPicker || !fsWindow.showDirectoryPicker) {
		setStatus('showDirectoryPicker() здесь не поддерживается. Откройте демо в Chromium-браузере.');
		return;
	}

	if (!confirmDiscardChanges()) {
		return;
	}

	try {
		const directoryHandle = await fsWindow.showDirectoryPicker({ mode: 'read' });
		setReadingDirectory(true);
		setStatus(`Сканирую папку ${directoryHandle.name}...`);
		renderFileTreeLoading();

		const { isTruncated, nodes } = await readDirectoryChildren(directoryHandle);
		state.treeNodes = nodes;
		state.expandedDirectoryIds = new Set();
		resetActiveFile();

		if (elements.directoryLabel) {
			elements.directoryLabel.textContent = `Выбрана папка: ${directoryHandle.name}`;
		}

		renderFileTree();
		await updatePermissionUi();
		setStatus(
			isTruncated
				? `Показаны первые ${maxEntriesPerDirectory} элементов папки ${directoryHandle.name}.`
				: `Папка ${directoryHandle.name} открыта. Вложенные папки загрузятся при раскрытии.`
		);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			setStatus('Выбор папки отменён.');
			return;
		}

		setStatus(error instanceof Error ? error.message : 'Не удалось открыть папку.');
	} finally {
		setReadingDirectory(false);
	}
};

const ensureWritePermission = async (fileHandle: DemoFileHandle) => {
	if (!fileHandle.createWritable) {
		setStatus('Браузер не поддерживает запись через createWritable().');
		return false;
	}

	if (fileHandle.queryPermission) {
		const permission = await fileHandle.queryPermission({ mode: 'readwrite' });

		if (permission === 'granted') {
			return true;
		}
	}

	if (!fileHandle.requestPermission) {
		setStatus('Браузер не поддерживает запрос права readwrite.');
		return false;
	}

	const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
	await updatePermissionUi();
	return permission === 'granted';
};

const saveActiveFile = async () => {
	if (!state.activeFileHandle || !elements.editor || state.activeFileKind !== 'text') {
		return;
	}

	try {
		const hasWriteAccess = await ensureWritePermission(state.activeFileHandle);

		if (!hasWriteAccess) {
			setStatus('Браузер не дал право на запись. Файл не изменён.');
			return;
		}

		const writable = await state.activeFileHandle.createWritable?.();

		if (!writable) {
			setStatus('Не удалось открыть поток записи для файла.');
			return;
		}

		await writable.write(elements.editor.value);
		await writable.close();

		state.activeFileText = elements.editor.value;
		setDirty(false);
		await updatePermissionUi();
		setStatus(`Сохранено в ${state.activeFileName}`);
	} catch (error) {
		setStatus(error instanceof Error ? error.message : 'Не удалось сохранить файл.');
	}
};

const renderSupport = () => {
	if (elements.supportBadge) {
		elements.supportBadge.textContent = support.showDirectoryPicker
			? support.createWritable
				? 'Полная поддержка'
				: 'Только чтение'
			: 'Нет доступа';
		elements.supportBadge.className = support.showDirectoryPicker
			? 'rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold uppercase text-emerald-800'
			: 'rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase text-amber-800';
	}

	if (elements.openDirectoryButton) {
		elements.openDirectoryButton.disabled = !support.showDirectoryPicker;
	}

	if (!support.showDirectoryPicker) {
		setStatus('Полный сценарий File System Access доступен только в Chromium-браузерах.');
	}
};

elements.openDirectoryButton?.addEventListener('click', openDirectory);
elements.saveButton?.addEventListener('click', saveActiveFile);

elements.fileTree?.addEventListener('click', (event) => {
	const button =
		event.target instanceof Element
			? event.target.closest<HTMLButtonElement>('button[data-entry-id]')
			: null;
	const entryId = button?.dataset.entryId;

	if (!button || button.disabled || !entryId) {
		return;
	}

	const entry = findNodeById(state.treeNodes, entryId);

	if (!entry) {
		return;
	}

	if (entry.kind === 'directory') {
		void toggleDirectoryEntry(entry);
		return;
	}

	void openFileEntry(entry);
});

elements.editor?.addEventListener('input', () => {
	setDirty(elements.editor?.value !== state.activeFileText);
});

renderSupport();
void updatePermissionUi();
