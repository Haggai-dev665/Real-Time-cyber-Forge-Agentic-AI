# Cyber Forge AI - Landing Page

Modern, responsive landing page built with Next.js and Tailwind CSS for the Cyber Forge AI cybersecurity platform.

## Features

- **Modern Design**: Cyberpunk-inspired design with glassmorphism effects
- **Responsive**: Fully responsive across all device sizes
- **Animations**: Smooth animations using Framer Motion
- **Performance**: Optimized for fast loading and SEO
- **Accessibility**: WCAG compliant with proper semantic markup

## Design Elements

- Gradient backgrounds with cybersecurity theme
- Glowing effects and cyber aesthetics
- Interactive hover animations
- Floating particles and visual effects
- Glass morphism UI components

## Sections

### Hero
- Main introduction with animated text
- Call-to-action buttons
- Floating background elements
- Scroll indicator

### Features
- Grid layout of key platform features
- Animated icons and hover effects
- Detailed feature descriptions

### How It Works
- Step-by-step process explanation
- Alternating layout for visual interest
- Progress indicators

### Download
- Platform-specific download options
- System requirements
- Feature highlights per platform

### Footer
- Contact information
- Newsletter signup
- Social media links
- Comprehensive site navigation

## Technology Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Heroicons
- **Fonts**: Google Fonts (Orbitron)

## Development

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Export static site:
```bash
npm run export
```

## Deployment

The site is configured for static export and can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Customization

### Colors
Update the color scheme in `tailwind.config.js`:
- `cyber-blue`: Primary brand color
- `cyber-dark`: Dark theme color
- Gradient colors for backgrounds

### Content
Modify the content in component files:
- Hero text in `components/Hero.js`
- Features in `components/Features.js`
- Steps in `components/HowItWorks.js`

### Animations
Customize animations using Framer Motion:
- Entrance animations
- Hover effects
- Scroll-triggered animations

## License

MIT License - see LICENSE file for details.