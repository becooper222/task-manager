# Task Manager

A full-stack task management application built with Next.js 14 and Supabase, featuring user authentication, drag-and-drop functionality, and a modern responsive UI optimized for both mobile and desktop.

## 🚀 Features

### Authentication & Security
- **User Registration & Login** via Supabase Auth
- **Protected Routes** with middleware-based authentication
- **Row-Level Security (RLS)** ensuring users only access their own data
- **Automatic Redirects** (unauthenticated → login, authenticated → dashboard)

### Task Management
- **Categories**: Create, delete, and reorder task categories with drag-and-drop
- **Tasks**: Full CRUD operations with date assignment, completion status, and favorites
- **Organization**: Tasks organized by categories with an "Overview" mode
- **Smart Filtering**: View tasks by category or see all tasks in overview mode

### Responsive Design & User Experience
- **Mobile-First Design**: Optimized for smartphones and tablets
- **Desktop Optimization**: Enhanced experience for larger screens
- **Touch-Friendly Interface**: Proper touch targets and gestures
- **Responsive Navigation**: Mobile hamburger menu and desktop navigation
- **Adaptive Layouts**: Forms and components that adapt to screen size
- **PWA Support**: Web app manifest and mobile app-like experience
- **Drag & Drop**: Reorder categories using React Beautiful DnD (desktop)
- **Real-time Updates**: Immediate UI feedback for all operations
- **Confirmation Dialogs**: Safe deletion with user confirmation
- **Loading States**: Proper loading indicators and error handling

### Mobile-Specific Features
- **Mobile Menu**: Collapsible navigation for mobile devices
- **Touch-Optimized Buttons**: 44px minimum touch targets
- **Responsive Forms**: Stacked form layouts on mobile
- **Mobile-Safe Typography**: Prevents zoom on iOS input fields
- **Swipe-Friendly Interface**: Optimized for touch interactions
- **Safe Area Support**: Respects device safe areas

### Desktop-Specific Features
- **Horizontal Category Navigation**: Side-by-side category display
- **Drag & Drop**: Full drag-and-drop functionality
- **Hover Effects**: Enhanced desktop interactions
- **Multi-Column Layouts**: Efficient use of screen real estate
- **Keyboard Navigation**: Full keyboard accessibility

## 🛠 Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom responsive utilities
- **Backend**: Supabase (PostgreSQL + Auth)
- **Database**: PostgreSQL with Row-Level Security
- **UI Components**: React Beautiful DnD for drag-and-drop
- **State Management**: React Context for authentication state
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **PWA Features**: Web app manifest and mobile optimization
- **Deployment**: Vercel with GitHub integration

## 📱 Responsive Design Features

### Breakpoints
- **Mobile**: < 768px (default)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px
- **Large Desktop**: > 1600px

### Mobile Optimizations
- **Touch Targets**: Minimum 44px for all interactive elements
- **Typography**: 16px base font size to prevent iOS zoom
- **Spacing**: Optimized padding and margins for mobile
- **Navigation**: Collapsible hamburger menu
- **Forms**: Stacked layout with proper spacing
- **Task Lists**: Mobile-optimized task display

### Desktop Enhancements
- **Hover Effects**: Enhanced visual feedback
- **Drag & Drop**: Full category reordering
- **Multi-Column**: Efficient space utilization
- **Keyboard Shortcuts**: Enhanced accessibility
- **Larger Touch Targets**: Comfortable desktop interaction

### Cross-Platform Features
- **Consistent Design System**: Unified color scheme and typography
- **Smooth Animations**: CSS transitions and micro-interactions
- **Accessibility**: ARIA labels and keyboard navigation
- **Performance**: Optimized loading and rendering
- **PWA Ready**: Web app manifest and mobile app features

## 📁 Project Structure

```
task-manager/
├── app/                    # Next.js app router
│   ├── dashboard/         # Main task management interface
│   ├── login/            # User authentication (responsive)
│   ├── signup/           # User registration (responsive)
│   ├── layout.tsx        # Root layout with responsive meta tags
│   └── page.tsx          # Home page (redirects to dashboard)
├── lib/                   # Utility libraries
│   ├── context/          # React context providers
│   │   └── AuthContext.tsx
│   ├── supabase.ts       # Client-side Supabase config
│   ├── supabase-server.ts # Server-side Supabase config
│   └── types.ts          # TypeScript type definitions
├── public/               # Static assets
│   ├── manifest.json     # PWA manifest
│   └── favicon.ico       # App icon
├── supabase/             # Database configuration
│   ├── migrations/       # Database schema migrations
│   ├── seed.sql          # Sample data
│   └── config.toml       # Supabase configuration
├── tailwind.config.ts    # Responsive design configuration
├── app/globals.css       # Global styles with responsive utilities
└── middleware.ts         # Route protection middleware
```

## 🗄 Database Schema

### Categories Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `name` (Text)
- `sort_order` (Integer)
- `inserted_at`, `updated_at` (Timestamps)

### Tasks Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `category_id` (UUID, Foreign Key to categories)
- `name` (Text)
- `date` (Date)
- `completed` (Boolean)
- `favorited` (Boolean)
- `inserted_at`, `updated_at` (Timestamps)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Git
- GitHub account
- Vercel account
- Supabase account and project

### Environment Setup
1. Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Local Development

1. **Install dependencies:**
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

2. **Set up the database:**
```bash
# Apply database migrations
npx supabase db push

# (Optional) Seed with sample data
npx supabase db reset
```

3. **Run the development server:**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

4. **Test responsive design:**
- Open [http://localhost:3000](http://localhost:3000) in your browser
- Use browser dev tools to test different screen sizes
- Test on actual mobile devices for best results

### Testing Responsive Features

#### Mobile Testing
- **Chrome DevTools**: Use device simulation
- **Real Devices**: Test on actual smartphones and tablets
- **Touch Interactions**: Verify touch targets and gestures
- **Performance**: Check loading times on slower connections

#### Desktop Testing
- **Multiple Screen Sizes**: Test on different monitor sizes
- **Hover Effects**: Verify desktop-specific interactions
- **Drag & Drop**: Test category reordering functionality
- **Keyboard Navigation**: Ensure full accessibility

### Deployment Workflow

This project uses **GitHub + Vercel** for automated deployments:

#### **Development Workflow:**
1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "Add your feature description"
   ```

3. **Push to GitHub:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** on GitHub to merge into your main branch

#### **Vercel Deployment:**
- **Automatic Deployments**: Every push to main branch deploys to production
- **Preview Deployments**: Every PR creates a preview URL for testing
- **Environment Variables**: Configure in Vercel dashboard for each environment
- **Mobile Optimization**: Vercel automatically optimizes for mobile

#### **Branch Strategy:**
- `main` - Production deployment
- `develop` - Staging/development deployment
- `feature/*` - Feature branches with preview deployments
- `hotfix/*` - Emergency fixes

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (used by Vercel)
- `npm run start` - Start production server (used by Vercel)
- `npm run lint` - Run ESLint

## 🔐 Security Features

- **Row-Level Security (RLS)**: Database policies ensure users only access their own data
- **Middleware Protection**: Route-level authentication checks
- **Secure Authentication**: Supabase Auth with proper session management
- **Input Validation**: Client and server-side validation
- **CORS Protection**: Proper CORS configuration

## 🎨 UI/UX Features

### Responsive Design
- **Mobile-First Approach**: Designed for mobile, enhanced for desktop
- **Adaptive Layouts**: Components that adapt to screen size
- **Touch Optimization**: Proper touch targets and gestures
- **Visual Hierarchy**: Clear information architecture across devices

### Modern Interface
- **Clean Design**: Minimalist, focused interface
- **Dark Theme**: Easy on the eyes with consistent color scheme
- **Smooth Animations**: Subtle transitions and micro-interactions
- **Loading States**: Clear feedback for all operations

### Accessibility
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Clear focus indicators
- **Color Contrast**: WCAG compliant color combinations

## 📱 Mobile Experience

### Touch-Friendly Design
- **44px Touch Targets**: iOS and Android recommended sizes
- **Gesture Support**: Swipe and tap interactions
- **Mobile Navigation**: Collapsible menu system
- **Responsive Forms**: Optimized input fields and buttons

### Performance
- **Fast Loading**: Optimized for mobile networks
- **Smooth Scrolling**: 60fps animations and transitions
- **Efficient Rendering**: Minimal re-renders and optimized components
- **Offline Ready**: PWA features for offline functionality

## 🖥 Desktop Experience

### Enhanced Interactions
- **Hover Effects**: Rich visual feedback
- **Drag & Drop**: Intuitive category management
- **Keyboard Shortcuts**: Power user features
- **Multi-Column Layouts**: Efficient space utilization

### Productivity Features
- **Bulk Operations**: Select multiple tasks
- **Quick Actions**: Keyboard shortcuts for common tasks
- **Advanced Filtering**: Multiple filter options
- **Export Features**: Data export capabilities

## 🔧 Customization

The application is built with modularity in mind:
- **Responsive Design**: Easily customizable breakpoints and layouts
- **Styling**: Flexible Tailwind CSS configuration
- **Components**: Reusable React components
- **Database**: Extensible schema with migrations
- **Authentication**: Configurable via Supabase dashboard

### Customizing Responsive Design
- **Breakpoints**: Modify in `tailwind.config.ts`
- **Mobile Layouts**: Adjust in component files
- **Touch Targets**: Update in `globals.css`
- **Animations**: Customize in CSS or Tailwind config

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test on multiple devices and screen sizes
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Responsive Design Guidelines
- **Mobile-First**: Always design for mobile first
- **Touch Targets**: Minimum 44px for interactive elements
- **Typography**: Use readable font sizes (16px minimum)
- **Performance**: Optimize for mobile networks
- **Testing**: Test on real devices, not just simulators

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team** for the amazing framework
- **Supabase Team** for the backend-as-a-service
- **Tailwind CSS** for the utility-first CSS framework
- **React Beautiful DnD** for drag-and-drop functionality
- **Vercel** for seamless deployment and hosting
