// Serverless Function для Vercel: безопасный прокси к API Авито.
// Секреты читаются ТОЛЬКО из переменных окружения (Vercel -> Settings -> Environment Variables).
export default async function handler(req, res) {
  // Разрешаем только GET (с фронта будем вызывать именно GET /api/avito)
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const clientId = process.env.AVITO_CLIENT_ID;
  const clientSecret = process.env.AVITO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "AVITO_CLIENT_ID / AVITO_CLIENT_SECRET не заданы в Environment Variables",
    });
  }

  try {
    // 1) Получаем access token по client_credentials
    const tokenRes = await fetch("https://api.avito.ru/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(502).json({
        error: "Не удалось получить токен Авито",
        detail: tokenData,
      });
    }

    const accessToken = tokenData.access_token;

    // 2) Разрешаем CORS только с нашего домена (Vercel доверие)
    res.setHeader("Access-Control-Allow-Origin", "*"); // при желании замени на свой домен
    res.setHeader("Access-Control-Allow-Methods", "GET");

    // 3) Запрашиваем мои товары
    const itemsRes = await fetch("https://api.avito.ru/core/v1/items", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    });

    const itemsData = await itemsRes.json();

    if (!itemsRes.ok) {
      return res.status(502).json({
        error: "Ошибка запроса к core/v1/items",
        detail: itemsData,
      });
    }

    // Нормализуем ответ: отдаём список карточек с нужными полями
    res.status(200).json({
      count: itemsData.items ? itemsData.items.length : 0,
      items: itemsData.items || [],
    });
  } catch (err) {
    res.status(500).json({ error: "Внутренняя ошибка сервера", detail: String(err && err.message || err) });
  }
}
