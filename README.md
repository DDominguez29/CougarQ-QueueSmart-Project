# QueueSmart

QueueSmart is a web application designed to improve the CTAP course-material pickup process at the UH Campus Store/Bookstore. The project replaces a traditional physical waiting line with a virtual, service-specific queue so students can see wait information and bookstore staff can better manage peak demand.

## Software Design Group #35 - FA 26

### Members

- Theo Mukoro - ID#: 2160830
- Diego Dominguez - ID#: 2234739
- Diego Carreon - ID#: 2281143
- Denzel Maldonado - ID#: 2407616

## Problem Statement

During the beginning of each semester, CTAP course-material pickups create significant lines at the UH Campus Store/Bookstore. Our QueueSmart application aims to replace and improve the traditional physical waiting process with a virtual, service-specific queue that gives students real-time wait information while giving bookstore staff better tools to manage peak demand.

## Development Methodology

We are following an Agile methodology because the project is being built in stages across multiple assignments. This allows the team to make changes frequently, review progress after each step, fix problems quickly, and improve features as the project grows.

Agile also fits our team workflow because different parts of the system can be developed separately, then brought together, tested, and refined as a group.

## Technologies Used

- TypeScript: Adds type safety to JavaScript, helping us catch errors earlier and keep the code easier to understand as the project grows.
- React: Lets us organize the interface into reusable components, which makes the application easier to build, maintain, and expand.
- CSS: Gives us direct control over page layout, styling, and responsive design without adding extra styling framework complexity.
- Vite: Provides a fast development environment for running and building the React application.
- React Router: Handles navigation between pages such as login, dashboard, queue status, and admin tools.

## Current Project Features

- Login and registration pages
- User dashboard for viewing queue information
- Join Queue page for selecting a bookstore service
- Queue Status page with position, wait time, and status information
- Queue history page
- Admin dashboard with service and queue metrics
- Service management tools for bookstore staff
- Queue management tools for monitoring students waiting

## Why These Technologies Fit the Project

TypeScript, React, and CSS give the project a simple but scalable foundation. TypeScript improves code reliability, React keeps the user interface organized through reusable components, and CSS allows the team to design the application clearly without unnecessary dependencies. Together, these technologies support a clean web application that can continue to grow as new project requirements are added.

## Getting Started

Install the project dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Check the code with ESLint:

```bash
npm run lint
```

Build the project:

```bash
npm run build
```

## Team Workflow

The team should use feature branches and pull requests so work can be reviewed before it is merged into the main branch. More detailed setup and Git instructions are available in `TEAM_GUIDE.md`.
