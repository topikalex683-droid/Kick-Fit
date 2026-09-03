// Serverless Function для Vercel: безопасный прокси к API Авито.
// Секреты читаются ТОЛЬКО из переменных окружения (Vercel -> Settings -> Environment Variables).
// Возвращает ТОЛЬКО активные объявления — снятые/проданные автоматически не попадают в список.

export default async function handler(req, res) {
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

  // CORS для фронта (при желании замени "*" на свой домен)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

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

    // 2) Запрашиваем объявления. per_page/page обязательны для core/v1/items.
    const itemsRes = await fetch(
      "https://api.avito.ru/core/v1/items?per_page=50&page=1",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const itemsData = await itemsRes.json();

    if (!itemsRes.ok) {
      return res.status(502).json({
        error: "Ошибка запроса к core/v1/items",
        detail: itemsData,
      });
    }

    const rawItems = itemsData.items || [];

    // 3) Оставляем ТОЛЬКО активные объявления.
    //    Статус "active" — объявление в продаже. Всё остальное (снято/продано/удалено)
    //    не попадает в выдачу и исчезает с сайта автоматически.
    const activeItems = rawItems.filter(function (it) {
      const st = it.status;
      // Если статус есть — берём только активные.
      // Если статуса нет в ответе — считаем товар доступным (лучше показать, чем скрыть),
      // но это редкий случай; обычно core/v1/items всегда отдаёт status.
      if (st === undefined || st === null) return true;
      return String(st).toLowerCase() === "active";
    });

    // Нормализуем: отдаём только нужные поля каждой карточки.
    const items = activeItems.map(function (it) {
      return {
        id: it.id,
        title: it.title || "",
        status: it.status || "active",
        price: it.price && it.price.value,
        description: it.description || "",
        images: (it.images || []).slice(0, 3).map(function (img) { return img.url || null; }),
        url: "https://www.avito.ru/" + it.id,
      };
    });

    res.status(200).json({
      count: items.length,
      items: items,
    });
  } catch (err) {
    res.status(500).json({ error: "Внутренняя ошибка сервера", detail: String(err && err.message || err) });
  }
}
