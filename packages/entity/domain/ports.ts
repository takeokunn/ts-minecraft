// Entity domain currently has no domain-level ports.
// Application services are exported from application modules and the package root,
// not from this domain barrel, to keep domain -> application imports out of the
// domain layer.
export {}
