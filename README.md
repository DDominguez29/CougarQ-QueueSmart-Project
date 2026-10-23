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

- TypeScript: Adds type safety to the frontend and backend, helping us catch errors earlier and keep the code easier to understand as the project grows.
- React: Lets us organize the interface into reusable components, which makes the application easier to build, maintain, and expand.
- Node.js: Runs the backend and lets the team use JavaScript and TypeScript across the application.
- Express: Organizes the backend API routes for queue management, visit history, and reporting.
- CSS: Gives us direct control over page layout, styling, and responsive design without adding extra styling framework complexity.
- Vite: Provides a fast development environment for running and building the React application.
- React Router: Handles navigation between pages such as login, dashboard, queue status, and admin tools.

## Current Project Features

- Login and registration pages
- User dashboard for viewing queue information
- Join Queue page for selecting a bookstore service
- Queue Status page with position, wait time, and status information
- User history page for completed and abandoned queue visits
- Admin dashboard with service and queue metrics
- Service management tools for bookstore staff
- Queue management tools for viewing waiting students, starting the next visit, and completing service
- Admin reports with completed visits, unique people served, and average queue wait time, using Houston local dates

Queue management, history, and reporting are connected to the shared backend in `server/`. Authentication and the remaining modules still need team integration. The current test login does not authenticate backend requests, so protected pages show a sign-in message until authentication is connected. Backend data is currently stored in memory and resets when the server restarts.

## Why These Technologies Fit the Project

TypeScript, React, and CSS keep the interface organized and easy to maintain. Node.js and Express provide the API that applies queue rules, records visit outcomes, and calculates bookstore reports. Using TypeScript across both sides helps the team keep data structures consistent as features are developed and integrated.

## Getting Started

Use Node.js 22.18 or later. Run the following commands from the repository root.

Install the project dependencies:

```bash
npm install
```

Start the backend API:

```bash
npm run dev:server
```

In a second terminal, start the frontend:

```bash
npm run dev
```

Open the frontend at the URL Vite prints in the terminal. The API runs at `http://127.0.0.1:3001`; check its health at `http://127.0.0.1:3001/api/health`. Vite forwards frontend requests beginning with `/api` to the backend.

Run the shared backend tests:

```bash
npm test
```

View backend test coverage:

```bash
npm run test:coverage
```

Check the code with ESLint:

```bash
npm run lint
```

Check frontend and backend types and build the frontend:

```bash
npm run build
```

See the [backend guide](server/README.md) for the API structure, module integration, data contracts, and testing details.

## Team Workflow

The team should use feature branches and pull requests so work can be reviewed before it is merged into the main branch. More detailed setup and Git instructions are available in the [team guide](TEAM_GUIDE.md).
