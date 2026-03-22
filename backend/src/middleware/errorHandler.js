export function errorHandler(err, _req, res, _next) {
    console.error(err);
    if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    if (err.code === "P2025") {
        return res.status(404).json({ error: "Record not found" });
    }
    if (err.code === "P2002") {
        return res.status(409).json({ error: "Duplicate value", detail: err.meta?.target });
    }
    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
}
