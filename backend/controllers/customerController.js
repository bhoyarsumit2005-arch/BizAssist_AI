import Customer from "../models/Customer.js";
import { getBusinessId } from "../utils/businessScope.js";

/** GET /api/customers — only this business's customers, newest first. */
export const listCustomers = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const customers = await Customer.find({ businessId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error("List customers error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
