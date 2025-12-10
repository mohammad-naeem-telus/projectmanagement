const healthCheck = (_req, res) => {
  try {
    res.status(200).json({
      status: "success",
      message: "API is running",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export default healthCheck;
