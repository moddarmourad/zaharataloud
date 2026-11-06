const { redisCommand } = require("./site-data");

const ORDER_INDEX_KEY = "zahrat:orders";
const ORDER_STATUS_VALUES = ["new", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

function orderKey(id) {
  return `zahrat:order:${id}`;
}

async function getOrder(id) {
  const saved = await redisCommand(["GET", orderKey(id)]);
  if (typeof saved !== "string") return null;
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error("Stored order record is invalid JSON:", error);
    throw new Error("A saved order record is invalid.");
  }
}

async function createOrder(order) {
  const key = orderKey(order.id);
  const created = await redisCommand(["SET", key, JSON.stringify(order), "NX"]);
  if (created !== "OK") {
    const existing = await getOrder(order.id);
    if (!existing) throw new Error("An order submission is already being processed.");
    await redisCommand(["ZADD", ORDER_INDEX_KEY, Date.parse(existing.createdAt), existing.id]);
    return { order: existing, created: false };
  }
  await redisCommand(["ZADD", ORDER_INDEX_KEY, Date.parse(order.createdAt), order.id]);
  return { order, created: true };
}

async function listOrders(limit = 100) {
  const ids = await redisCommand(["ZREVRANGE", ORDER_INDEX_KEY, "0", String(limit - 1)]);
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const savedOrders = await redisCommand(["MGET", ...ids.map(orderKey)]);
  if (!Array.isArray(savedOrders)) throw new Error("Shared storage returned an invalid order list.");
  return savedOrders.flatMap((saved, index) => {
    if (typeof saved !== "string") return [];
    try {
      return [JSON.parse(saved)];
    } catch (error) {
      console.error("Stored order record is invalid JSON:", error);
      throw new Error(`Saved order ${ids[index]} is invalid.`);
    }
  });
}

async function updateOrderStatus(id, status) {
  if (!ORDER_STATUS_VALUES.includes(status)) return null;
  const order = await getOrder(id);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  await redisCommand(["SET", orderKey(id), JSON.stringify(order)]);
  return order;
}

async function updateOrderNotifications(id, notifications) {
  const order = await getOrder(id);
  if (!order) throw new Error("The saved order could not be found.");
  order.notifications = { ...order.notifications, ...notifications };
  order.updatedAt = new Date().toISOString();
  await redisCommand(["SET", orderKey(id), JSON.stringify(order)]);
  return order;
}

module.exports = { ORDER_STATUS_VALUES, createOrder, listOrders, updateOrderNotifications, updateOrderStatus };
