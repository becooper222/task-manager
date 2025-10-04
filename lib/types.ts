export type Category = {
  id: string
  name: string
  sort_order: number
  inserted_at: string
  updated_at: string
  member_count?: number
}

export type Task = {
  id: string
  user_id: string
  category_id: string
  name: string
  date: string
  completed: boolean
  favorited: boolean
  inserted_at: string
  updated_at: string
}

export type CategoryRole = 'owner' | 'editor' | 'viewer'

export type CategoryMember = {
  user_id: string
  email: string
  role: CategoryRole
  is_you: boolean
} 