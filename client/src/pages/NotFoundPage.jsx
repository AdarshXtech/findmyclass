import { useNavigate } from 'react-router-dom'
import { HiOutlineArrowLeft, HiOutlineLocationMarker } from 'react-icons/hi'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 relative px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-[-20%] left-[30%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />

      <div className="relative text-center animate-scale-in">
        {/* 404 */}
        <div className="relative mb-8">
          <span className="text-[120px] sm:text-[160px] font-black text-white/5 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <HiOutlineLocationMarker className="text-4xl text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
          Looks like this classroom doesn't exist. Let's get you back on track.
        </p>

        <button
          onClick={() => navigate('/')}
          className="btn-primary inline-flex items-center gap-2"
        >
          <HiOutlineArrowLeft />
          Back to Home
        </button>
      </div>
    </div>
  )
}
