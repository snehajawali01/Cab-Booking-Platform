
"use client";

import { useState } from "react";

const API = "http://127.0.0.1:8000";

const initialForm = {
  pickup_address: "Kompally, Hyderabad",
  dropoff_address: "Alwal, Hyderabad",
  pickup_latitude: "17.535",
  pickup_longitude: "78.486",
  dropoff_latitude: "17.515",
  dropoff_longitude: "78.508",
};

export default function RiderHome() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [estimate, setEstimate] = useState(null);
  const [rides, setRides] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "The request failed. Please try again."
      );
    }

    return data;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setEstimate(null);
  }

  function ridePayload() {
    const values = [
      form.pickup_latitude,
      form.pickup_longitude,
      form.dropoff_latitude,
      form.dropoff_longitude,
    ].map(Number);

    if (
      values.some((value) => !Number.isFinite(value)) ||
      Number(form.pickup_latitude) < -90 ||
      Number(form.pickup_latitude) > 90 ||
      Number(form.dropoff_latitude) < -90 ||
      Number(form.dropoff_latitude) > 90 ||
      Number(form.pickup_longitude) < -180 ||
      Number(form.pickup_longitude) > 180 ||
      Number(form.dropoff_longitude) < -180 ||
      Number(form.dropoff_longitude) > 180
    ) {
      throw new Error("Please enter valid latitude and longitude values.");
    }

    return {
      pickup_address: form.pickup_address.trim(),
      dropoff_address: form.dropoff_address.trim(),
      pickup_latitude: values[0],
      pickup_longitude: values[1],
      dropoff_latitude: values[2],
      dropoff_longitude: values[3],
    };
  }

  async function authenticate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        await apiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: name,
            email,
            phone_number: phone || null,
            password,
          }),
        });

        setMessage("Account created! You can now sign in.");
        setMode("login");
        setPassword("");
        return;
      }

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setToken(data.access_token);
      setUser(data.user);
      setPassword("");
      await loadRides(data.access_token);
      setMessage(`Welcome, ${data.user.full_name}!`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRides(accessToken = token) {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API}/api/rides/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load ride history.");
      }

      setRides(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function estimateFare() {
    setLoading(true);
    setMessage("");

    try {
      const ride = ridePayload();

      if (!ride.pickup_address || !ride.dropoff_address) {
        throw new Error("Enter both pickup and drop-off addresses.");
      }

      const data = await apiRequest("/api/rides/estimate", {
        method: "POST",
        body: JSON.stringify({
          pickup: {
            latitude: ride.pickup_latitude,
            longitude: ride.pickup_longitude,
          },
          dropoff: {
            latitude: ride.dropoff_latitude,
            longitude: ride.dropoff_longitude,
          },
        }),
      });

      setEstimate(data);
      setMessage("Fare estimate calculated successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function bookRide(event) {
    event.preventDefault();

    if (!token) {
      setMessage("Please sign in before booking a ride.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const ride = ridePayload();

      if (!ride.pickup_address || !ride.dropoff_address) {
        throw new Error("Enter both pickup and drop-off addresses.");
      }

      const created = await apiRequest("/api/rides/request", {
        method: "POST",
        body: JSON.stringify(ride),
      });

      setMessage(
        `Ride #${created.id} booked! Estimated fare: ₹${Number(
          created.estimated_fare
        ).toFixed(2)}.`
      );

      setEstimate(null);
      await loadRides(token);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRide(rideId) {
    setLoading(true);
    setMessage("");

    try {
      await apiRequest(`/api/rides/${rideId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });

      setMessage(`Ride #${rideId} cancelled.`);
      await loadRides();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setToken("");
    setUser(null);
    setRides([]);
    setEstimate(null);
    setPassword("");
    setMessage("You have signed out.");
    setMode("login");
  }

  function money(value) {
    return value == null ? "Not set" : `\u20B9${Number(value).toFixed(2)}`;
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    marginTop: "6px",
    border: "1px solid #d7deea",
    borderRadius: "9px",
    fontSize: "14px",
    background: "#fff",
    color: "#172033",
  };

  const labelStyle = {
    display: "block",
    marginTop: "14px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  };

  const primaryButton = {
    border: 0,
    borderRadius: "10px",
    padding: "13px 18px",
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };

  const cardStyle = {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "22px",
    marginBottom: "20px",
    boxShadow: "0 5px 20px rgba(15,23,42,0.03)",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fc",
        color: "#172033",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "18px 6%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <a
          href="/"
          style={{
            fontSize: "25px",
            fontWeight: 800,
            color: "#1d4ed8",
            textDecoration: "none",
          }}
        >
          CabGo
        </a>

        <nav style={{ display: "flex", gap: "18px", alignItems: "center" }}>
          <a href="#book" style={{ color: "#334155" }}>Book a cab</a>
          <a href="#history" style={{ color: "#334155" }}>My rides</a>
          <a href="/driver" style={{ color: "#334155" }}>Driver portal</a>
          {token && (
            <button onClick={logout} style={primaryButton}>
              Sign out
            </button>
          )}
        </nav>
      </header>

      <section
        style={{
          padding: "48px 6%",
          background: "linear-gradient(120deg,#e8efff,#f7f9ff)",
        }}
      >
        <p style={{ color: "#2563eb", fontWeight: 800, letterSpacing: "2px" }}>
          YOUR CITY. YOUR RIDE.
        </p>
        <h1 style={{ fontSize: "clamp(32px,5vw,52px)", margin: "12px 0" }}>
          Your journey starts with CabGo.
        </h1>
        <p style={{ color: "#64748b", lineHeight: 1.7, maxWidth: "620px" }}>
          Plan your trip, estimate your fare, book a ride, and track your
          booking status in one place.
        </p>
      </section>

      <div style={{ maxWidth: "1000px", margin: "28px auto", padding: "0 18px" }}>
        {!token ? (
          <section style={cardStyle}>
            <h2>{mode === "login" ? "Rider sign in" : "Create a rider account"}</h2>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              {mode === "login"
                ? "Sign in to book rides and see your ride history."
                : "Register to start booking rides with CabGo."}
            </p>

            <form onSubmit={authenticate}>
              {mode === "register" && (
                <>
                  <label style={labelStyle}>
                    Full name
                    <input
                      style={fieldStyle}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>

                  <label style={labelStyle}>
                    Phone number (optional)
                    <input
                      style={fieldStyle}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={20}
                    />
                  </label>
                </>
              )}

              <label style={labelStyle}>
                Email address
                <input
                  style={fieldStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label style={labelStyle}>
                Password
                <input
                  style={fieldStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "register" ? 8 : undefined}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{ ...primaryButton, marginTop: "20px" }}
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            <p style={{ marginTop: "18px", fontSize: "14px" }}>
              {mode === "login" ? "New to CabGo? " : "Already registered? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setMessage("");
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#2563eb",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {mode === "login" ? "Create an account" : "Sign in instead"}
              </button>
            </p>
          </section>
        ) : (
          <p style={{ ...cardStyle, color: "#166534" }}>
            Signed in as <strong>{user?.full_name || user?.email || email}</strong>
          </p>
        )}

        <section id="book" style={cardStyle}>
          <h2>Book your ride</h2>
          <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6 }}>
            Enter both addresses and their coordinates. The default coordinates
            are examples for a Hyderabad-area demo; edit them for your actual trip.
          </p>

          <form onSubmit={bookRide}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "20px",
              }}
            >
              <div>
                <h3>Pickup</h3>
                <label style={labelStyle}>
                  Pickup address
                  <input
                    name="pickup_address"
                    style={fieldStyle}
                    value={form.pickup_address}
                    onChange={updateField}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Latitude
                  <input
                    name="pickup_latitude"
                    type="number"
                    step="any"
                    style={fieldStyle}
                    value={form.pickup_latitude}
                    onChange={updateField}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Longitude
                  <input
                    name="pickup_longitude"
                    type="number"
                    step="any"
                    style={fieldStyle}
                    value={form.pickup_longitude}
                    onChange={updateField}
                    required
                  />
                </label>
              </div>

              <div>
                <h3>Drop-off</h3>
                <label style={labelStyle}>
                  Drop-off address
                  <input
                    name="dropoff_address"
                    style={fieldStyle}
                    value={form.dropoff_address}
                    onChange={updateField}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Latitude
                  <input
                    name="dropoff_latitude"
                    type="number"
                    step="any"
                    style={fieldStyle}
                    value={form.dropoff_latitude}
                    onChange={updateField}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Longitude
                  <input
                    name="dropoff_longitude"
                    type="number"
                    step="any"
                    style={fieldStyle}
                    value={form.dropoff_longitude}
                    onChange={updateField}
                    required
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "22px" }}>
              <button
                type="button"
                onClick={estimateFare}
                disabled={loading}
                style={{ ...primaryButton, background: "#0f766e" }}
              >
                {loading ? "Please wait..." : "Estimate fare"}
              </button>

              <button
                type="submit"
                disabled={loading || !token}
                style={{ ...primaryButton, opacity: token ? 1 : 0.55 }}
              >
                {loading ? "Processing..." : "Book ride"}
              </button>
            </div>

            {!token && (
              <p style={{ color: "#64748b", fontSize: "13px" }}>
                Sign in above before booking. Fare estimation can be tried without signing in.
              </p>
            )}
          </form>

          {estimate && (
            <div
              style={{
                marginTop: "20px",
                padding: "18px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#065f46",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Estimated trip fare</h3>
              <p>Distance: <strong>{estimate.distance_km} km</strong></p>
              <p>Estimated fare: <strong>{money(estimate.estimated_fare)}</strong></p>
              <small>Estimate only; the actual fare is determined by the backend.</small>
            </div>
          )}
        </section>

        <section id="history" style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2>My rides</h2>
            {token && (
              <button
                onClick={() => loadRides()}
                disabled={loading}
                style={primaryButton}
              >
                Refresh rides
              </button>
            )}
          </div>

          {!token ? (
            <p style={{ color: "#64748b" }}>Sign in to see your ride history.</p>
          ) : rides.length === 0 ? (
            <p style={{ color: "#64748b" }}>No rides found for this account yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {rides.map((ride) => (
                <article
                  key={ride.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <h3 style={{ marginTop: 0 }}>Ride #{ride.id}</h3>
                    <strong style={{ color: "#1d4ed8", textTransform: "capitalize" }}>
                      {ride.status.replaceAll("_", " ")}
                    </strong>
                  </div>

                  <p>Pickup: {ride.pickup_address}</p>
                  <p>Drop-off: {ride.dropoff_address}</p>
                  <p>Distance: {ride.distance_km} km</p>
                  <p>Estimated fare: {money(ride.estimated_fare)}</p>
                  <p>Final fare: {money(ride.final_fare)}</p>

                  {["requested", "accepted"].includes(ride.status) && (
                    <button
                      onClick={() => cancelRide(ride.id)}
                      disabled={loading}
                      style={{ ...primaryButton, background: "#b91c1c" }}
                    >
                      Cancel ride
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {message && (
          <p
            role="status"
            style={{
              ...cardStyle,
              background: "#eff6ff",
              color: "#1e40af",
              overflowWrap: "anywhere",
            }}
          >
            {message}
          </p>
        )}
      </div>

      <footer
        style={{
          padding: "26px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        CabGo · Cab Booking Platform · 2026
      </footer>
    </main>
  );
}
