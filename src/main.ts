import { resolveDataMode } from "./environment";

// Callback takes priority over all mode/hash parameters, including demo URLs.
let authReturn = window.__fonsecaAuthReturn;
delete window.__fonsecaAuthReturn;
const authRoute =
  Boolean(authReturn) ||
  location.pathname === "/auth/callback" ||
  location.pathname === "/auth/login";
const bookingRoute =
  location.pathname === "/agendar" || location.pathname === "/agendar/";
const barberRoute =
  location.pathname === "/barbeiro" ||
  location.pathname.startsWith("/barbeiro/");
const mode =
  authRoute || bookingRoute || barberRoute
    ? "real"
    : resolveDataMode(location.search);
document.documentElement.dataset.dataMode = mode;
if (authRoute) {
  const { startAuthPage } = await import("./auth/page");
  try {
    await startAuthPage(
      authReturn ??
        (location.pathname === "/auth/callback"
          ? {
              origin: location.origin,
              pathname: location.pathname,
              search: "",
              hash: "",
            }
          : undefined),
    );
  } finally {
    // Do not retain the one-time code in module scope after the callback.
    // eslint-disable-next-line no-useless-assignment
    authReturn = undefined;
  }
} else if (
  location.pathname === "/inicio" ||
  location.pathname === "/inicio/"
) {
  const { startLanding } = await import("./landing");
  startLanding();
} else if (bookingRoute) {
  const { startBookingPage } = await import("./booking-page");
  startBookingPage();
} else if (barberRoute) {
  const { startBarberPage } = await import("./barber-page");
  startBarberPage();
} else if (mode === "demo") {
  await import("./demo-app");
} else {
  const { startRealApp } = await import("./real-app");
  await startRealApp();
}
