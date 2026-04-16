import { activities } from "@/lib/data"
import { Calendar } from "lucide-react"

export default function ActivityPage() {
  return (
    <div className="py-24 md:py-32">
      {/* Header */}
      <section className="px-6 mb-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            What We Do
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
            Activities
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From hands-on workshops to cupping sessions, discover experiences 
            that deepen your connection with coffee.
          </p>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {["All", "Workshop", "Cupping", "Event"].map((filter) => (
              <button
                key={filter}
                className={`px-6 py-2 rounded-full text-sm transition-colors ${
                  filter === "All"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Grid */}
      <section className="px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => (
              <article 
                key={activity.id}
                className="group cursor-pointer"
              >
                <div 
                  className="aspect-[4/3] bg-muted rounded-lg overflow-hidden relative mb-4"
                  style={{
                    backgroundImage: `url('${activity.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-block px-3 py-1 bg-background/90 backdrop-blur-sm text-xs uppercase tracking-wider rounded-full">
                      {activity.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(activity.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h2 className="text-xl font-medium mb-2 group-hover:text-accent transition-colors">
                  {activity.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {activity.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
