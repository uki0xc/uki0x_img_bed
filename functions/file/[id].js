import mime from 'mime';

export async function onRequest(context) {
  const { request, env, params } = context;
  
  // Get file ID from URL parameters
  const fileUniqueId = params.id;
  
  if (!fileUniqueId) {
    return new Response(JSON.stringify({ error: "File ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get file metadata from KV store
    const metadataStr = await env.FILE_STORE.get(fileUniqueId);
    
    if (!metadataStr) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const metadata = JSON.parse(metadataStr);
    const { fileId, mimeType, fileName } = metadata;

    // Get file path from Telegram
    const TG_BOT_TOKEN = env.TG_BOT_TOKEN;
    const filePathResponse = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    
    const filePathData = await filePathResponse.json();
    
    if (!filePathData.ok || !filePathData.result.file_path) {
      return new Response(JSON.stringify({ error: "Failed to get file path from Telegram" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const filePath = filePathData.result.file_path;
    
    // Fetch the file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${filePath}`;
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch file from Telegram" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Determine content type
    const contentType = mimeType || mime.getType(fileName) || 'application/octet-stream';
    
    // Create response with appropriate headers
    const finalResponse = new Response(fileResponse.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
    
    return finalResponse;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Error fetching file" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
