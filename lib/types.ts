export type Category = {
  id: string
  user_id: string
  name: string
  sort_order: number
  inserted_at: string
  updated_at: string
}

export type Task = {
  id: string
  user_id: string
  category_id: string
  name: string
  description?: string
  date: string
  completed: boolean
  favorited: boolean
  inserted_at: string
  updated_at: string
} 