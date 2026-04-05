import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Users } from "lucide-react";

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Public Header */}
      <header className="flex items-center bg-[var(--golf-primary)] text-white h-14 px-6 gap-4 shadow-md">
        <Image
          src="/GolfChallengePoint_Logo40.png"
          alt="Golf Challenge Point"
          width={40}
          height={40}
          priority
          unoptimized
        />
        <span className="font-bold text-lg">Golf Challenge Point</span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="border-white text-white bg-transparent hover:bg-white hover:text-[var(--golf-primary)]"
            >
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-white text-[var(--golf-primary)] hover:bg-gray-100"
            >
              Sign Up
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-[#e8f5e9] to-white">
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--golf-heading)] mb-4">
          Elevate Your Golf Game
        </h1>
        <p className="text-lg text-[var(--golf-muted-text)] max-w-xl mb-10">
          Track your progress, complete challenges, and improve your performance
          with personalised coaching tools.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/signup">
            <Button className="bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white px-8 py-3 text-base">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              className="border-[var(--golf-primary)] text-[var(--golf-primary)] px-8 py-3 text-base hover:bg-[var(--golf-accent)]"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-8 px-8 py-14 bg-white max-w-5xl mx-auto w-full">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="rounded-full bg-[var(--golf-accent)] p-4">
            <Trophy className="h-8 w-8 text-[var(--golf-primary)]" />
          </div>
          <h3 className="font-semibold text-[var(--golf-heading)]">Challenges</h3>
          <p className="text-sm text-[var(--golf-muted-text)]">
            Complete daily and weekly challenges to improve every aspect of your
            game.
          </p>
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="rounded-full bg-[var(--golf-accent)] p-4">
            <TrendingUp className="h-8 w-8 text-[var(--golf-primary)]" />
          </div>
          <h3 className="font-semibold text-[var(--golf-heading)]">
            Performance Tracking
          </h3>
          <p className="text-sm text-[var(--golf-muted-text)]">
            Monitor your scores, handicap trends, and training sessions over
            time.
          </p>
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="rounded-full bg-[var(--golf-accent)] p-4">
            <Users className="h-8 w-8 text-[var(--golf-primary)]" />
          </div>
          <h3 className="font-semibold text-[var(--golf-heading)]">Coaching</h3>
          <p className="text-sm text-[var(--golf-muted-text)]">
            Connect with your coach and get personalised training plans and
            feedback.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-[var(--golf-muted-text)] py-4 border-t">
        © {new Date().getFullYear()} Golf Challenge Point
      </footer>
    </div>
  );
}