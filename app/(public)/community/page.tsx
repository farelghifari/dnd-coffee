import { communityEvents, activities } from "@/lib/data"
import { Users, Calendar, Coffee, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CommunityPage() {
  const workshops = activities.filter(a => a.category === "workshop")

  return (
    <div className="py-24 md:py-32">
      {/* Header */}
      <section className="px-6 mb-24">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Together
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
            Community
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join a collective of coffee enthusiasts, creative minds, and curious souls. 
            Together, we learn, create, and caffeinate.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 mb-24">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Users, value: "500+", label: "Community Members" },
              { icon: Coffee, value: "120+", label: "Workshops Held" },
              { icon: Calendar, value: "Weekly", label: "Meetups" },
              { icon: Sparkles, value: "12", label: "Partner Roasters" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-6 w-6 text-accent" />
                </div>
                <div className="text-3xl font-light mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="px-6 mb-24 bg-secondary py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Programs
            </p>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight">
              Regular Events
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {communityEvents.map((event) => (
              <div 
                key={event.id}
                className="bg-card rounded-lg overflow-hidden border border-border"
              >
                <div 
                  className="aspect-video bg-muted"
                  style={{
                    backgroundImage: `url('${event.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="p-6">
                  <h3 className="text-xl font-medium mb-3">
                    {event.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {event.description}
                  </p>
                  <p className="text-sm font-medium text-accent">
                    {event.schedule}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workshops */}
      <section className="px-6 mb-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Learn
            </p>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight">
              Upcoming Workshops
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {workshops.map((workshop) => (
              <div 
                key={workshop.id}
                className="group flex gap-6 p-6 rounded-lg border border-border hover:border-accent/50 transition-colors"
              >
                <div 
                  className="w-32 h-32 shrink-0 bg-muted rounded-lg"
                  style={{
                    backgroundImage: `url('${workshop.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(workshop.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <h3 className="text-xl font-medium mb-2 group-hover:text-accent transition-colors">
                    {workshop.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {workshop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">
            Ready to join us?
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Whether you are a seasoned barista or just beginning your coffee journey, 
            there is a place for you in our community.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="px-8">
              Join a Workshop
            </Button>
            <Button size="lg" variant="outline" className="px-8">
              Newsletter Signup
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
