// Serverless Function для Vercel: безопасный прокси к API Авито.
// Секреты читаются ТОЛЬКО из переменных окружения (Vercel -> Settings -> Environment Variables).
// Возвращает ВСЕ активные объявления с пагинацией и ссылками на фото.

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

    // 2) Проходим по всем страницам списка объявлений.
    const perPage = 100;
    let page = 1;
    let allItems = [];
    let lastPage = null;

    do {
      const itemsRes = await fetch(
        "https://api.avito.ru/core/v1/items?per_page=" + perPage + "&page=" + page,
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
        // При ошибке на первой странице возвращаем ошибку,
        // при ошибке на последующих — просто останавливаем докачку.
        if (page === 1) {
          return res.status(502).json({
            error: "Ошибка запроса к core/v1/items",
            detail: itemsData,
          });
        }
        break;
      }

      allItems = allItems.concat(itemsData.items || []);

      // Пагинация: ищем номер последней страницы.
      const pag = itemsData.pagination || itemsData.pagination_data || {};
      lastPage = pag.last_page || pag.total_pages || pag.lastPage || null;

      page++;
      // Страховка от бесконечного цикла.
      if (page > 50) break;
    } while (lastPage && page <= lastPage);

    // 3) Оставляем только активные объявления.
    const activeItems = allItems.filter(function (it) {
      const st = it.status;
      if (st === undefined || st === null) return true;
      return String(st).toLowerCase() === "active";
    });

    // 4) Нормализуем: id, title, price, изображения, ссылка.
    const items = activeItems.map(function (it) {
      const images = (it.images || []).map(function (img) {
        return img && (img.url || img["640x480"] || img.full_url);
      }).filter(Boolean);

      return {
        id: it.id,
        title: it.title || "",
        status: it.status || "active",
        price: it.price && it.price.value,
        description: it.description || "",
        images: images,
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
