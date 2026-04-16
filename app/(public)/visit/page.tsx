import { shopInfo } from "@/lib/data"
import { MapPin, Clock, Phone, Mail, Instagram, Coffee, Wifi, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function VisitPage() {
  return (
    <div className="py-24 md:py-32">
      {/* Header */}
      <section className="px-6 mb-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Find Us
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
            Visit
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We would love to serve you. Find us in the heart of South Jakarta, 
            where every cup is crafted with intention.
          </p>
        </div>
      </section>

      {/* Map + Info Grid */}
      <section className="px-6 mb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Map Placeholder */}
            <div 
              className="aspect-square lg:aspect-auto lg:min-h-[500px] bg-muted rounded-lg relative overflow-hidden"
              style={{
                backgroundImage: "url('/images/map-placeholder.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-foreground/5 flex items-center justify-center">
                <div className="bg-background/95 backdrop-blur-sm p-6 rounded-lg text-center max-w-xs">
                  <MapPin className="h-8 w-8 mx-auto mb-4 text-accent" />
                  <p className="font-medium mb-2">{shopInfo.name}</p>
                  <p className="text-sm text-muted-foreground">{shopInfo.address}</p>
                  <Button className="mt-4" size="sm">
                    Open in Maps
                  </Button>
                </div>
              </div>
            </div>

            {/* Info Cards */}
            <div className="space-y-6">
              {/* Hours */}
              <div className="p-8 rounded-lg border border-border">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <h2 className="text-xl font-medium">Opening Hours</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-muted-foreground">Monday - Friday</span>
                    <span className="font-medium">{shopInfo.hours.weekday}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-muted-foreground">Saturday - Sunday</span>
                    <span className="font-medium">{shopInfo.hours.weekend}</span>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="p-8 rounded-lg border border-border">
                <h2 className="text-xl font-medium mb-6">Contact</h2>
                <div className="space-y-4">
                  <a 
                    href={`tel:${shopInfo.phone}`}
                    className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="h-5 w-5" />
                    {shopInfo.phone}
                  </a>
                  <a 
                    href={`mailto:${shopInfo.email}`}
                    className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-5 w-5" />
                    {shopInfo.email}
                  </a>
                  <a 
                    href={`https://instagram.com/${shopInfo.social.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Instagram className="h-5 w-5" />
                    {shopInfo.social.instagram}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="px-6 mb-24 bg-secondary py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
              What to Expect
            </h2>
            <p className="text-muted-foreground">
              A space designed for focus, creativity, and great coffee.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Coffee, title: "Specialty Coffee", desc: "Single-origin beans, expertly roasted" },
              { icon: Wifi, title: "Fast WiFi", desc: "100Mbps for your work needs" },
              { icon: Laptop, title: "Power Outlets", desc: "At every table" },
              { icon: Clock, title: "Extended Hours", desc: "Open late on weekends" },
            ].map((amenity) => (
              <div key={amenity.title} className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <amenity.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-medium mb-2">{amenity.title}</h3>
                <p className="text-sm text-muted-foreground">{amenity.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Address CTA */}
      <section className="px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">
            See you soon
          </h2>
          <p className="text-xl text-muted-foreground mb-2">
            {shopInfo.address}
          </p>
          <p className="text-muted-foreground mb-8">
            Look for the minimalist storefront with the wooden door.
          </p>
          <Button size="lg" className="px-8">
            Get Directions
          </Button>
        </div>
      </section>
    </div>
  )
}
