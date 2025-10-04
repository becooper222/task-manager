# Backup File Format

## Overview
This application supports importing tasks and categories from Excel (.xlsx) backup files.

## File Format

The Excel file should contain a single sheet with the following columns:

| Column Name | Description | Required | Format |
|------------|-------------|----------|--------|
| **Category** | The name of the category | Yes | Text |
| **Task** | The name of the task | Yes | Text |
| **Date** | The due date for the task | No | Date (YYYY-MM-DD) or Excel date |
| **Favorite** | Whether the task is favorited | No | Boolean (true/false, yes/no, 1/0) |
| **Status** or **Completed** | Whether the task is completed | No | Status: "completed"/"active", or Boolean: true/false, yes/no, 1/0 |

### Column Name Variations
The import system is case-insensitive and supports multiple variations:
- **Category**: `Category`, `category`, `CATEGORY`
- **Task**: `Task`, `task`, `TASK`, `Name`, `name`
- **Date**: `Date`, `date`, `DATE`
- **Favorite**: `Favorite`, `favorite`, `FAVORITE`, `Favorited`, `favorited`
- **Status/Completed**: `Status`, `status`, `STATUS`, `Completed`, `completed`, `COMPLETED`, `Complete`, `complete`
  - Completed values: `completed`, `done`, `complete`, `finished`, `true`, `yes`, `1`
  - Active values: `active`, `incomplete`, `pending`, `in progress`, `false`, `no`, `0`

## Example

```
Category    | Task                    | Date       | Favorite | Status
------------|-------------------------|------------|----------|----------
Work        | Review project proposal | 2024-10-10 | true     | active
Work        | Send follow-up email    | 2024-10-11 | false    | completed
Personal    | Grocery shopping        | 2024-10-05 | false    | completed
Personal    | Call dentist            | 2024-10-12 | true     | active
```

## Import Behavior

1. **Categories**: Categories are created automatically based on the unique category names in the file
2. **Sort Order**: New categories are appended after existing categories
3. **Tasks**: Task completion status is preserved from the file
4. **Dates**: If no date is provided, today's date is used as default
5. **Favorites**: If not specified, tasks default to not favorited
6. **Completed**: If not specified, tasks default to incomplete/active

## Notes

- All imported categories will be added to your existing categories (no overwrite)
- Tasks will be grouped by category during import
- The import process will provide feedback on how many categories and tasks were created
- If a row is missing required fields (Category or Task), it will be skipped

## Using the Template

1. Click "📥 Download Template" to get a pre-formatted Excel file
2. Fill in your categories, tasks, dates, and favorites
3. Save the file
4. Click "📤 Upload Backup" to import your tasks

