export async function validateRicardoSession(cookies: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.ricardo.ch/api/mfa/search?searchTerm=test&size=1&apiToken=`,
      {
        headers: {
          Cookie: cookies,
          Accept: "application/json",
          "User-Agent": "RITU/1.0",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && "articles" in data) {
      const articles = (data as { articles: unknown }).articles;
      return Array.isArray(articles);
    }
    return false;
  } catch {
    return false;
  }
}

export async function validateTuttiSession(cookies: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.tutti.ch/de/q/test`, {
      headers: {
        Cookie: cookies,
        "User-Agent": "RITU/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    if (res.status === 403) return false;
    const text = await res.text();
    // If still Cloudflare challenge, not valid
    if (text.includes("cf-mitigated") || text.includes("cf_clearance")) {
      // ambiguous, but if we got 200, consider valid
    }
    return text.includes("/de/vi/") || text.includes("CHF") || text.length > 1000;
  } catch {
    return false;
  }
}
