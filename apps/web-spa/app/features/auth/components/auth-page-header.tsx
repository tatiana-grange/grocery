import * as React from 'react'

interface AuthPageHeaderProps {
  title: string
  description: string
}

export const AuthPageHeader: React.FC<AuthPageHeaderProps> = ({ title, description }) => (
  <div className="mb-6 space-y-4">
    <h1 className="font-serif text-4xl font-semibold text-balance">{title}</h1>
    <p className="text-lg text-muted-foreground">{description}</p>
  </div>
)
