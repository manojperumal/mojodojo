import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Wrench,
  FileText,
  Database,
  UserCircle,
  ClipboardList,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface SidebarProps {
  role: 'owner' | 'gc' | 'trade'
}

const ownerNav: NavItem[] = [
  { label: 'Dashboard', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Projects', path: '/owner/projects', icon: <FolderOpen size={18} /> },
  { label: 'Members', path: '/owner/members', icon: <Users size={18} /> },
  { label: 'Trades', path: '/owner/trades', icon: <Wrench size={18} /> },
  { label: 'Questionnaires', path: '/owner/questionnaires', icon: <FileText size={18} /> },
  { label: 'Question Bank', path: '/owner/question-bank', icon: <Database size={18} /> },
]

const gcNav: NavItem[] = [
  { label: 'Dashboard', path: '/gc/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Projects', path: '/gc/projects', icon: <FolderOpen size={18} /> },
  { label: 'Trades', path: '/gc/trades', icon: <Wrench size={18} /> },
  { label: 'My Profile', path: '/gc/profile', icon: <UserCircle size={18} /> },
  { label: 'Questionnaires', path: '/gc/questionnaires', icon: <FileText size={18} /> },
]

const tradeNav: NavItem[] = [
  { label: 'Dashboard', path: '/trade/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'My Assignments', path: '/trade/assignments', icon: <ClipboardList size={18} /> },
  { label: 'My Profile', path: '/trade/profile', icon: <UserCircle size={18} /> },
]

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation()
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
      {item.label}
      {isActive && <ChevronRight size={14} className="ml-auto text-blue-400" />}
    </Link>
  )
}

export default function Sidebar({ role }: SidebarProps) {
  const navItems = role === 'owner' ? ownerNav : role === 'gc' ? gcNav : tradeNav

  const roleLabel = role === 'owner' ? 'Owner' : role === 'gc' ? 'General Contractor' : 'Trade Contractor'
  const roleColor = role === 'owner' ? 'bg-purple-100 text-purple-700' : role === 'gc' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-gray-900">MojoDojo</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
          {roleLabel}
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.path} item={item} />
        ))}
      </nav>
    </aside>
  )
}
