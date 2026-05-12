# BookCar.com — Frontend

A full-stack React frontend for the BookCar ride-booking app, built to connect with your Spring Boot backend.

---

## Tech Stack

- **React 18** with hooks (no Redux, no router library — pure state-based navigation)
- **Vite** for dev server and build
- **Vanilla CSS** with CSS variables design system
- **Google Fonts** — Clash Display + Cabinet Grotesk

---

## Quick Start

### 1. Install dependencies
```bash
cd bookcar
npm install
```

### 2. Start your Spring Boot backend
Make sure your backend is running on `http://localhost:8080`

### 3. Start the frontend
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Endpoints Used

All calls are proxied via Vite to `http://localhost:8080` — no CORS config needed.

### Auth (`/auth`)
| Method | Endpoint | Page | DTO |
|--------|----------|------|-----|
| POST | `/auth/signup` | Signup | `SignupDto { name, email, password }` |
| POST | `/auth/login` | Login | `{ email, password }` |
| POST | `/auth/onBoardNewDriver/{userId}` | Signup / Profile | `OnboardDriverDto { vehicleId }` |

### Rider (`/riders`)
| Method | Endpoint | Page | DTO |
|--------|----------|------|-----|
| POST | `/riders/requestRide` | Book Ride | `RideRequestDto` |
| POST | `/riders/cancelRide/{rideId}` | Book Ride | — |
| POST | `/riders/rateDriver` | Book Ride | `RatingDto { rideId, rating }` |
| GET | `/riders/getMyProfile` | Dashboard / Profile | — |
| GET | `/riders/getMyRides` | Rides | `?pageOffset=0&pageSize=10` |

### Driver (`/drivers`)
| Method | Endpoint | Page | DTO |
|--------|----------|------|-----|
| POST | `/drivers/acceptRide/{rideRequestId}` | Driver Panel | — |
| POST | `/drivers/startRide/{rideRequestId}` | Driver Panel | `RideStartDto { otp }` |
| POST | `/drivers/endRide/{rideId}` | Driver Panel | — |
| POST | `/drivers/cancelRide/{rideId}` | Driver Panel | — |
| POST | `/drivers/rateRider` | Driver Panel | `RatingDto { rideId, rating }` |
| GET | `/drivers/getMyProfile` | Dashboard / Profile | — |
| GET | `/drivers/getMyRides` | Rides | `?pageOffset=0&pageSize=10` |

---

## Pickup/Drop Coordinates Format

Your backend uses GeoJSON `Point` format. The frontend sends:

```json
{
  "pickupLocation": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "dropOffLocation": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "paymentMethod": "CASH"
}
```

> **Note**: GeoJSON uses `[longitude, latitude]` order (not lat/lng). The Book Ride form takes lat/lng inputs and swaps them automatically.

---

## Authentication

The app stores the JWT token (if your backend returns one) in `localStorage` and sends it as:

```
Authorization: Bearer <token>
```

If your backend doesn't use JWT yet, the demo login buttons on the Login page let you explore all pages without a real backend response.

### Login response shape expected:
```json
{
  "token": "eyJ...",
  "user": {
    "name": "Alex",
    "email": "alex@email.com",
    "roles": ["RIDER"]
  }
}
```

Or if you return the `UserDto` directly (without wrapping), that also works — the app handles both formats.

---

## Pages

| Page | Route (state) | Who can see |
|------|---------------|-------------|
| Home | `home` | Everyone |
| Sign Up | `signup` | Unauthenticated |
| Login | `login` | Unauthenticated |
| Dashboard | `dashboard` | Logged in |
| Book Ride | `book` | Riders |
| Driver Panel | `driver` | Drivers |
| My Rides | `rides` | Logged in |
| Profile | `profile` | Logged in |

---

## Spring Boot CORS Config

Add this to your Spring Boot app to allow the Vite dev server:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("http://localhost:3000")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
```

Or use the Vite proxy (already configured in `vite.config.js`) — no CORS config needed.

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host (Vercel, Netlify, nginx, etc.).

---

## Project Structure

```
bookcar/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── context/
    │   └── AuthContext.jsx
    ├── hooks/
    │   └── useToast.js
    ├── components/
    │   ├── Navbar.jsx
    │   └── ToastContainer.jsx
    ├── pages/
    │   ├── HomePage.jsx
    │   ├── SignupPage.jsx
    │   ├── LoginPage.jsx
    │   ├── DashboardPage.jsx
    │   ├── BookRidePage.jsx
    │   ├── DriverPanelPage.jsx
    │   ├── RidesPage.jsx
    │   └── ProfilePage.jsx
    └── services/
        └── api.js
```
