import { forwardRef } from 'react'

interface FeatureCardProps {
  title: string
  description: string
  icon: string
}

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        {icon}
      </div>

      <h3 className="feature-title">{title}</h3>

      <p className="feature-description">{description}</p>
    </div>
  )
}

export const FeaturesSection = forwardRef<HTMLElement>((props, ref) => {
  const features = [
    {
      title: 'Scheduling',
      description: 'Easily schedule your worship team volunteers and coordinate rehearsals with our intuitive calendar system.',
      icon: '📅'
    },
    {
      title: 'Song Bank',
      description: 'Build and manage your church\'s song library with lyrics, chords, and arrangement notes all in one place.',
      icon: '🎵'
    },
    {
      title: 'Team Management',
      description: 'Keep track of your team members, their skills, and availability to build the perfect worship team.',
      icon: '👥'
    }
  ]

  return (
    <section ref={ref} id="features" className="features">
      <div className="features-content">
        <h2 className="section-title">Features</h2>

        <div className="features-grid">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </div>
      </div>
    </section>
  )
}) 