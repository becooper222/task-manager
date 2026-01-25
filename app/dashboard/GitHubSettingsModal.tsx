'use client'

import { useEffect, useState } from 'react'
import { CategoryGitHubRepo } from '@/lib/types'

type Repo = {
  id: number
  full_name: string
  name: string
  owner: string
  default_branch: string
  private: boolean
}

export default function GitHubSettingsModal({
  categoryId,
  categoryName,
  onClose,
  onRepoLinked,
}: {
  categoryId: string
  categoryName: string
  onClose: () => void
  onRepoLinked: () => void
}) {
  const [linkedRepo, setLinkedRepo] = useState<CategoryGitHubRepo | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [showWorkflowInstructions, setShowWorkflowInstructions] = useState(false)

  useEffect(() => {
    fetchLinkedRepo()
    fetchRepos()
  }, [categoryId])

  const fetchLinkedRepo = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}/github`)
      if (!res.ok) throw new Error('Failed to fetch linked repo')
      const data = await res.json()
      setLinkedRepo(data.repo)
    } catch (e) {
      console.error('Error fetching linked repo:', e)
    }
  }

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/auth/github/repos')
      if (!res.ok) {
        if (res.status === 400) {
          setError('GitHub not connected. Please connect your GitHub account first.')
          return
        }
        throw new Error('Failed to fetch repos')
      }
      const data = await res.json()
      setRepos(data.repos || [])
    } catch (e) {
      console.error('Error fetching repos:', e)
      setError('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkRepo = async () => {
    if (!selectedRepo) return
    setLinking(true)
    setError(null)

    try {
      const res = await fetch(`/api/categories/${categoryId}/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_full_name: selectedRepo }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to link repository')
      }

      const data = await res.json()
      setLinkedRepo(data.repo)
      setShowWorkflowInstructions(true)
      onRepoLinked()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to link repository')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkRepo = async () => {
    if (!confirm('Are you sure you want to unlink this repository?')) return

    try {
      const res = await fetch(`/api/categories/${categoryId}/github`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to unlink repository')

      setLinkedRepo(null)
      setSelectedRepo('')
      onRepoLinked()
    } catch (e) {
      console.error('Error unlinking repo:', e)
      setError('Failed to unlink repository')
    }
  }

  const workflowYaml = `name: Claude Code Task Runner
on:
  workflow_dispatch:
    inputs:
      task_prompt:
        description: 'Task prompt for Claude Code'
        required: true
      run_id:
        description: 'Task manager run ID'
        required: true
      callback_url:
        description: 'Webhook URL for results'
        required: true
      branch_name:
        description: 'Branch to create'
        required: false

permissions:
  contents: write
  pull-requests: write

jobs:
  run-claude-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create branch
        if: \${{ inputs.branch_name != '' }}
        run: git checkout -b \${{ inputs.branch_name }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Run Claude Code
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude "\${{ inputs.task_prompt }}" --dangerously-skip-permissions

      - name: Commit changes
        id: commit
        run: |
          git config user.name "Claude Code Bot"
          git config user.email "claude-code@noreply.github.com"
          if [[ -n \$(git status --porcelain) ]]; then
            git add -A
            git commit -m "Claude Code: \${{ inputs.task_prompt }}"
            git push origin \${{ inputs.branch_name }}
            echo "pushed=true" >> \$GITHUB_OUTPUT
          else
            echo "pushed=false" >> \$GITHUB_OUTPUT
          fi

      - name: Create Pull Request
        id: pr
        if: steps.commit.outputs.pushed == 'true'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_URL=\$(gh pr create \\
            --title "Claude Code: \${{ inputs.task_prompt }}" \\
            --body "Automated changes by Claude Code.\\n\\n**Task:** \${{ inputs.task_prompt }}\\n**Run ID:** \${{ inputs.run_id }}" \\
            --base main \\
            --head \${{ inputs.branch_name }})
          echo "pr_url=\$PR_URL" >> \$GITHUB_OUTPUT

      - name: Report results
        if: always()
        run: |
          curl -X POST "\${{ inputs.callback_url }}" \\
            -H "Content-Type: application/json" \\
            -H "X-Webhook-Secret: \${{ secrets.TASK_MANAGER_WEBHOOK_SECRET }}" \\
            -d '{
              "run_id": "\${{ inputs.run_id }}",
              "status": "\${{ job.status }}",
              "workflow_run_id": \${{ github.run_id }},
              "workflow_run_url": "\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}",
              "pr_url": "\${{ steps.pr.outputs.pr_url || '' }}"
            }'`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-accent flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            GitHub Settings - {categoryName}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-text-secondary">Loading...</div>
          ) : error && !linkedRepo ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <a
                href="/api/auth/github"
                className="px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Connect GitHub
              </a>
            </div>
          ) : linkedRepo ? (
            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-medium text-text-primary">{linkedRepo.repo_full_name}</p>
                      <p className="text-sm text-text-secondary">Branch: {linkedRepo.default_branch}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUnlinkRepo}
                    className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50"
                  >
                    Unlink
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowWorkflowInstructions(!showWorkflowInstructions)}
                className="w-full px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary text-left flex items-center justify-between"
              >
                <span>Workflow Setup Instructions</span>
                <span>{showWorkflowInstructions ? '▲' : '▼'}</span>
              </button>

              {showWorkflowInstructions && (
                <div className="p-4 bg-secondary rounded-lg space-y-4">
                  <p className="text-text-primary">
                    To enable Claude Code integration, add this workflow file to your repository:
                  </p>
                  <p className="text-sm text-text-secondary">
                    File path: <code className="bg-accent px-1 rounded">.github/workflows/claude-code.yml</code>
                  </p>
                  <div className="relative">
                    <pre className="bg-background p-4 rounded-md overflow-x-auto text-xs text-text-primary">
                      {workflowYaml}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(workflowYaml)}
                      className="absolute top-2 right-2 px-2 py-1 text-xs bg-accent rounded hover:bg-primary"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-sm text-text-secondary space-y-2">
                    <p className="font-medium text-text-primary">Required repository secrets:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><code className="bg-accent px-1 rounded">ANTHROPIC_API_KEY</code> - Your Anthropic API key</li>
                      <li><code className="bg-accent px-1 rounded">TASK_MANAGER_WEBHOOK_SECRET</code> - See value below</li>
                    </ul>
                    {linkedRepo.webhook_secret && (
                      <div className="mt-3 p-3 bg-background rounded-md">
                        <p className="font-medium text-text-primary mb-1">Your Webhook Secret:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-accent px-2 py-1 rounded break-all flex-1">
                            {linkedRepo.webhook_secret}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(linkedRepo.webhook_secret!)}
                            className="px-2 py-1 text-xs bg-accent rounded hover:bg-primary shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-text-secondary">
                Link a GitHub repository to enable Claude Code integration for tasks in this category.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  Select Repository
                </label>
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full p-2 bg-secondary border border-accent rounded-md text-text-primary"
                >
                  <option value="">Choose a repository...</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name} {repo.private && '(private)'}
                    </option>
                  ))}
                </select>
              </div>
              {selectedRepo && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md">
                  <div className="flex gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-500">Security Warning</p>
                      <p className="text-yellow-200/80 mt-1">
                        Claude Code will run with <code className="bg-yellow-900/50 px-1 rounded">--dangerously-skip-permissions</code>,
                        allowing it to execute commands and modify files without confirmation prompts.
                        Only link repositories you trust and review all generated pull requests before merging.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleLinkRepo}
                disabled={!selectedRepo || linking}
                className="w-full px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linking ? 'Linking...' : 'Link Repository'}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-accent">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-secondary text-text-primary rounded-md hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
