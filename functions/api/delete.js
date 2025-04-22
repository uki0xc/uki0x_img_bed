export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Check if it's a POST request
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const { fileUniqueId } = await request.json();
    
    if (!fileUniqueId) {
      return new Response(JSON.stringify({ error: "Missing fileUniqueId" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Check if file exists
    const fileMetadata = await env.FILE_STORE.get(fileUniqueId);
    if (!fileMetadata) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Delete from KV store
    await env.FILE_STORE.delete(fileUniqueId);

    // Purge cache if CF API credentials are available
    if (env.CF_API_KEY && env.CF_EMAIL && env.CF_ZONE_ID) {
      try {
        const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
        const urlPrefix = userConfig.urlPrefix || `https://${request.headers.get("host")}/file/`;
        const fileUrl = `${urlPrefix}${fileUniqueId}`;
        
        await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Email': env.CF_EMAIL,
            'X-Auth-Key': env.CF_API_KEY,
          },
          body: JSON.stringify({
            files: [fileUrl],
          }),
        });
      } catch (cacheError) {
        console.error("Failed to purge cache:", cacheError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete file" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
