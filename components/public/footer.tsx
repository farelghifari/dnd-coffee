import Link from "next/link"
import { shopInfo } from "@/lib/data"

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-semibold tracking-tight mb-4">
              {shopInfo.name}
            </h3>
            <p className="text-primary-foreground/70 max-w-md leading-relaxed">
              {shopInfo.tagline}. A space where specialty coffee meets creative minds.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-sm uppercase tracking-wider text-primary-foreground/60">
              Navigation
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/activity" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Activity
                </Link>
              </li>
              <li>
                <Link href="/album" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Album
                </Link>
              </li>
              <li>
                <Link href="/community" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Community
                </Link>
              </li>
              <li>
                <Link href="/visit" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Visit
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-sm uppercase tracking-wider text-primary-foreground/60">
              Contact
            </h4>
            <ul className="space-y-3 text-primary-foreground/80">
              <li>{shopInfo.address}</li>
              <li>{shopInfo.phone}</li>
              <li>
                <a href={`mailto:${shopInfo.email}`} className="hover:text-primary-foreground transition-colors">
                  {shopInfo.email}
                </a>
              </li>
              <li className="pt-2">
                <a 
                  href={`https://instagram.com/${shopInfo.social.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-foreground transition-colors"
                >
                  {shopInfo.social.instagram}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-primary-foreground/10 text-center text-primary-foreground/50 text-sm">
          <p>2026 {shopInfo.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
