// Client API wrapper for Openleaf Go Backend

import { env } from '$env/dynamic/public';

const BACKEND_URL = env.PUBLIC_BACKEND_URL || 'http://localhost:8080';

export interface Project {
	id: string;
	name: string;
	ownerId: string;
	rootFileId?: string;
	role: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectFile {
	id: string;
	projectId: string;
	path: string;
	isBinary: boolean;
	content?: string;
	storageKey?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CompileJob {
	id: string;
	projectId: string;
	userId?: string;
	versionId: number;
	status: 'queued' | 'running' | 'succeeded' | 'failed' | 'none';
	pdfStorageKey?: string;
	logStorageKey?: string;
	errorMessage?: string;
	startedAt?: string;
	finishedAt?: string;
	createdAt?: string;
}

export class ApiClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const headers = new Headers(options.headers || {});
		if (this.token) {
			headers.set('Authorization', `Bearer ${this.token}`);
		}
		if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
			headers.set('Content-Type', 'application/json');
		}

		const response = await fetch(`${BACKEND_URL}${endpoint}`, {
			...options,
			headers
		});

		if (!response.ok) {
			let errorMsg = `API Error ${response.status}: ${response.statusText}`;
			try {
				const errorData = (await response.json()) as { error?: string };
				if (errorData?.error) errorMsg = errorData.error;
			} catch {
				// Keep fallback message
			}
			throw new Error(errorMsg);
		}

		return response.json();
	}

	async listProjects(): Promise<Project[]> {
		return this.request<Project[]>('/api/projects');
	}

	async createProject(name: string): Promise<Project> {
		return this.request<Project>('/api/projects', {
			method: 'POST',
			body: JSON.stringify({ name })
		});
	}

	async getProject(projectId: string): Promise<Project> {
		return this.request<Project>(`/api/projects/${projectId}`);
	}

	async deleteProject(projectId: string): Promise<{ message: string }> {
		return this.request<{ message: string }>(`/api/projects/${projectId}`, {
			method: 'DELETE'
		});
	}

	async listFiles(projectId: string): Promise<ProjectFile[]> {
		return this.request<ProjectFile[]>(`/api/projects/${projectId}/files`);
	}

	async getFile(projectId: string, fileId: string): Promise<ProjectFile> {
		return this.request<ProjectFile>(`/api/projects/${projectId}/files/${fileId}`);
	}

	async createFile(projectId: string, filePath: string, content?: string): Promise<ProjectFile> {
		return this.request<ProjectFile>(`/api/projects/${projectId}/files`, {
			method: 'POST',
			body: JSON.stringify({
				path: filePath,
				content: content ?? '',
				isBinary: false
			})
		});
	}

	async updateFileContent(
		projectId: string,
		fileId: string,
		content: string
	): Promise<{ message: string }> {
		return this.request<{ message: string }>(`/api/projects/${projectId}/files/${fileId}`, {
			method: 'PUT',
			body: JSON.stringify({ content })
		});
	}

	async deleteFile(projectId: string, fileId: string): Promise<{ message: string }> {
		return this.request<{ message: string }>(`/api/projects/${projectId}/files/${fileId}`, {
			method: 'DELETE'
		});
	}

	async compileProject(projectId: string): Promise<CompileJob> {
		return this.request<CompileJob>(`/api/projects/${projectId}/compile`, {
			method: 'POST'
		});
	}

	async getCompileStatus(projectId: string): Promise<CompileJob> {
		return this.request<CompileJob>(`/api/projects/${projectId}/compile/status`);
	}

	async getCompilePdfBlob(projectId: string): Promise<Blob> {
		const headers = new Headers();
		if (this.token) {
			headers.set('Authorization', `Bearer ${this.token}`);
		}
		const response = await fetch(`${BACKEND_URL}/api/projects/${projectId}/compile/pdf`, {
			headers
		});
		if (!response.ok) {
			throw new Error('Failed to fetch compiled PDF');
		}
		return response.blob();
	}

	async getCompileLog(projectId: string): Promise<string> {
		const headers = new Headers();
		if (this.token) {
			headers.set('Authorization', `Bearer ${this.token}`);
		}
		const response = await fetch(`${BACKEND_URL}/api/projects/${projectId}/compile/log`, {
			headers
		});
		if (!response.ok) {
			return '';
		}
		return response.text();
	}
}
