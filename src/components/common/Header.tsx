import Link from 'next/link'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-screen-md mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-blue-600">
          가챠맵
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search" className="text-gray-600 hover:text-gray-900">
            검색
          </Link>
          <Link href="/wishlist" className="text-gray-600 hover:text-gray-900">
            찜
          </Link>
          <Link href="/report" className="text-gray-600 hover:text-gray-900">
            제보
          </Link>
        </nav>
      </div>
    </header>
  )
}
