'use client';

export default function RootPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center px-4 py-10">
      <img
        src="/logo.png"
        alt="Go집될집"
        className="w-full max-w-[460px] h-auto mx-auto"
      />
      <button
        type="button"
        className="mt-8 btn btn-cta"
        onClick={() => {
          window.location.href = '/onboarding';
        }}
      >
        서비스 시작하기
      </button>
    </div>
  );
}
