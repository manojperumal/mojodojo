import { Database } from 'lucide-react'

export default function QuestionBankPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <span>Question Bank</span>
      </nav>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
          <Database size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 text-sm">Reusable questions for questionnaire templates</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
        Question bank coming soon.
      </div>
    </div>
  )
}
