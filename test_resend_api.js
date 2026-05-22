

async function run() {
  console.log("Sending resend-otp request to http://localhost:5000/api/auth/resend-otp...");
  try {
    const res = await fetch("http://localhost:5000/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sayyedyaseen419@gmail.com" })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  } catch (error) {
    console.error("Request failed:", error);
  }
}

run();
