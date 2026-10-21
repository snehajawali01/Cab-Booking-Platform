
"use client";

import { useState } from "react";

const API = "http://127.0.0.1:8000";

export default function DriverDashboard() {
  const [email, setEmail] = useState("rider@example.com");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [driver, setDriver] = useState(null);
  const [rides, setRides] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }

      const accessToken = data.access_token;
      if (!accessToken) {
        throw new Error("The login response did not contain an access token.");
      }

      setToken(accessToken);
      await loadRides(accessToken);
    } catch (error) {
      setMessage(error.message || "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRides(accessToken = token) {
    if (!accessToken) {
      setMessage("Please log in first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/api/drivers/me/rides`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load assigned rides.");
      }

      setDriver(data.driver);
      setRides(data.rides || []);
      setMessage(
        `Loaded ${data.total_rides ?? (data.rides || []).length} assigned rides.`
      );
    } catch (error) {
      setMessage(error.message || "Could not load rides.");
    } finally {
      setLoading(false);
    }
  }

  async function updateRideStatus(rideId, status) {
    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/drivers/rides/${rideId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not update ride status.");
      }

      setMessage(data.message || "Ride status updated successfully.");
      await loadRides(token);
    } catch (error) {
      setMessage(error.message || "Could not update ride status.");
    } finally {
      setLoading(false);
    }
  }

    async function toggleAvailability() {
    if (!token || !driver) {
      setMessage("Please log in first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/api/drivers/me/availability`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_available: !driver.is_available,
          latitude: driver.current_latitude ?? 17.555,
          longitude: driver.current_longitude ?? 78.367,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not update driver availability."
        );
      }

      setDriver((previous) => ({
        ...previous,
        ...data,
        is_available: data.is_available ?? !previous.is_available,
      }));

      setMessage(
        data.message ||
          `You are now ${
            data.is_available ?? !driver.is_available
              ? "available"
              : "unavailable"
          }.`
      );
    } catch (error) {
      setMessage(error.message || "Could not update availability.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setDriver(null);
    setRides([]);
    setPassword("");
    setMessage("You have logged out.");
  }
      const completedRides = rides.filter(
    (ride) => ride.status === "completed"
  ).length;

  const activeRides = rides.filter(
    (ride) => ["accepted", "in_progress"].includes(ride.status)
  ).length;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a href="/" style={styles.brand}>
          <span style={styles.logo}>C</span>
          CabGo
        </a>
        <span style={styles.headerLabel}>DRIVER DASHBOARD</span>
      </header>

      <section style={styles.hero}>
        <p style={styles.eyebrow}>YOUR DRIVER WORKSPACE</p>
        <h1 style={styles.title}>Every ride, one place.</h1>
        <p style={styles.subtitle}>
          View assigned rides, start journeys, and update ride completion.
        </p>
      </section>

      {!token ? (
        <section style={styles.loginCard}>
          <h2 style={styles.heading}>Driver login</h2>
          <p style={styles.muted}>
            Sign in with the account linked to your registered driver profile.
          </p>

          <form onSubmit={login} style={styles.form}>
            <label style={styles.label} htmlFor="driver-email">
              Email address
            </label>
            <input
              id="driver-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />

            <label style={styles.label} htmlFor="driver-password">
              Password
            </label>
            <input
              id="driver-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
            />

            <button
              type="submit"
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? "Signing in..." : "Sign in to dashboard"}
            </button>
          </form>

          <p style={styles.smallNote}>
            Use the test account password you registered earlier.
          </p>
        </section>
      ) : (
        <>
          <section style={styles.profileCard}>
            <div>
              <p style={styles.eyebrow}>SIGNED IN DRIVER</p>
              <h2 style={styles.heading}>
                {driver?.full_name || "Loading driver profile..."}
              </h2>
              <p style={styles.muted}>
                {driver?.vehicle_model || "Vehicle"} ·{" "}
                {driver?.vehicle_number || "Vehicle number"}
              </p>
              <p style={styles.muted}>
                Availability:{" "}
                <strong>
                  {driver
                    ? driver.is_available
                      ? "Available"
                      : "Unavailable"
                    : "Loading"}
                </strong>
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={toggleAvailability}
                disabled={loading || !driver}
                style={
                  driver?.is_available
                    ? styles.secondaryButton
                    : styles.primaryButton
                }
              >
                {loading
                  ? "Updating..."
                  : driver?.is_available
                    ? "Go unavailable"
                    : "Go available"}
              </button>

              <button
                type="button"
                onClick={logout}
                style={styles.secondaryButton}
              >
                Log out
              </button>
            </div>
          </section>
          <section style={styles.stats}>
            <div style={styles.statCard}>
              <span style={styles.statNumber}>{rides.length}</span>
              <span style={styles.statLabel}>Assigned rides</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statNumber}>{activeRides}</span>
              <span style={styles.statLabel}>Active rides</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statNumber}>{completedRides}</span>
              <span style={styles.statLabel}>Completed rides</span>
            </div>
          </section>

          <section style={styles.ridesSection}>
            <div style={styles.sectionHeader}>

              <div>
                <p style={styles.eyebrow}>YOUR BOOKINGS</p>
                <h2 style={styles.heading}>Assigned rides</h2>
              </div>
              <button
                type="button"
                onClick={() => loadRides()}
                disabled={loading}
                style={styles.secondaryButton}
              >
                {loading ? "Refreshing..." : "Refresh rides"}
              </button>
            </div>

            {rides.length === 0 ? (
              <div style={styles.emptyCard}>
                <h3>No assigned rides yet</h3>
                <p style={styles.muted}>
                  Assigned rides will appear here when available.
                </p>
              </div>
            ) : (
              <div style={styles.rideList}>
                {rides.map((ride) => (
                  <article key={ride.id} style={styles.rideCard}>
                    <div style={styles.rideTop}>
                      <div>
                        <span style={styles.rideId}>RIDE #{ride.id}</span>
                        <h3 style={styles.rideTitle}>
                          {ride.pickup_address}
                        </h3>
                        <p style={styles.destination}>
                          To: {ride.dropoff_address}
                        </p>
                      </div>
                      <span
                        style={{
                          ...styles.status,
                          ...(ride.status === "completed"
                            ? styles.completedStatus
                            : ride.status === "in_progress"
                              ? styles.progressStatus
                              : styles.defaultStatus),
                        }}
                      >
                        {ride.status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div style={styles.rideDetails}>
                      <div>
                        <span style={styles.detailLabel}>Distance</span>
                        <strong>{ride.distance_km} km</strong>
                      </div>
                      <div>
                        <span style={styles.detailLabel}>Estimated fare</span>
                        <strong>
                          \u20B9{Number(ride.estimated_fare || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span style={styles.detailLabel}>Final fare</span>
                        <strong>
                          {ride.final_fare == null
                            ? "Not set"
                            : `\u20B9${Number(ride.final_fare).toFixed(2)}`}
                        </strong>
                      </div>
                    </div>

                    {ride.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateRideStatus(ride.id, "in_progress")
                        }
                        disabled={loading}
                        style={styles.primaryButton}
                      >
                        Start ride
                      </button>
                    )}

                    {ride.status === "in_progress" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateRideStatus(ride.id, "completed")
                        }
                        disabled={loading}
                        style={styles.completeButton}
                      >
                        Complete ride
                      </button>
                    )}

                    {ride.status === "completed" && (
                      <p style={styles.completedNote}>
                        \u2713 This ride has been completed.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {message && (
        <p role="status" aria-live="polite" style={styles.message}>
          {message}
        </p>
      )}

      <footer style={styles.footer}>
        CabGo Â· Driver Dashboard Â· 2026
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "0 20px 30px",
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto",
    minHeight: 76,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid #e1e6ef",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 23,
    fontWeight: 800,
    color: "#172033",
    textDecoration: "none",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "#176b52",
    color: "white",
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#64748b",
  },
  hero: {
    maxWidth: 1100,
    margin: "42px auto 28px",
  },
  eyebrow: {
    margin: "0 0 10px",
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: 800,
    color: "#176b52",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "clamp(30px, 5vw, 46px)",
    letterSpacing: -1.4,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
  },
  heading: {
    margin: "0 0 8px",
    fontSize: 23,
  },
  muted: {
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
  },
  loginCard: {
    maxWidth: 480,
    margin: "0 auto",
    padding: 28,
    borderRadius: 18,
    background: "#fff",
    border: "1px solid #e1e6ef",
    boxShadow: "0 12px 35px rgba(20, 35, 55, 0.05)",
  },
  form: {
    display: "grid",
    gap: 10,
    marginTop: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 8,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "13px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 15,
    background: "#fff",
    color: "#172033",
  },
  primaryButton: {
    border: 0,
    borderRadius: 10,
    padding: "13px 17px",
    background: "#176b52",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  completeButton: {
    border: 0,
    borderRadius: 10,
    padding: "13px 17px",
    background: "#172033",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
    width: "100%",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    background: "#fff",
    color: "#172033",
    fontWeight: 700,
    cursor: "pointer",
  },
  smallNote: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
    marginTop: 18,
  },
  profileCard: {
    maxWidth: 1100,
    margin: "0 auto 20px",
    padding: 22,
    borderRadius: 16,
    background: "#fff",
    border: "1px solid #e1e6ef",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  stats: {
    maxWidth: 1100,
    margin: "0 auto 30px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e1e6ef",
    borderRadius: 15,
    padding: 20,
    display: "grid",
    gap: 8,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: 800,
    color: "#176b52",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  ridesSection: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  rideList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: 16,
  },
  rideCard: {
    background: "#fff",
    border: "1px solid #e1e6ef",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rideTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  rideId: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.3,
    color: "#64748b",
  },
  rideTitle: {
    fontSize: 17,
    margin: "10px 0 5px",
    overflowWrap: "anywhere",
  },
  destination: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  },
  status: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  },
  completedStatus: {
    background: "#dcfce7",
    color: "#166534",
  },
  progressStatus: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  defaultStatus: {
    background: "#fef3c7",
    color: "#92400e",
  },
  rideDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
    gap: 12,
    padding: "16px 0",
    borderTop: "1px solid #edf0f5",
    borderBottom: "1px solid #edf0f5",
  },
  detailLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    marginBottom: 7,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 16,
    border: "1px dashed #cbd5e1",
    background: "#fff",
    textAlign: "center",
  },
  completedNote: {
    margin: 0,
    color: "#166534",
    fontSize: 13,
    fontWeight: 700,
  },
  message: {
    maxWidth: 1100,
    margin: "24px auto",
    padding: 14,
    borderRadius: 10,
    background: "#e8f5ef",
    color: "#176b52",
    overflowWrap: "anywhere",
  },
  footer: {
    maxWidth: 1100,
    margin: "50px auto 0",
    paddingTop: 20,
    borderTop: "1px solid #e1e6ef",
    textAlign: "center",
    fontSize: 12,
    color: "#64748b",
  },
};

