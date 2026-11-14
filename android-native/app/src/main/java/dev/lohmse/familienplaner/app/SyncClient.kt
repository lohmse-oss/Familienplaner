package dev.lohmse.familienplaner.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

// Spricht dasselbe Protokoll wie server/sync-server.js bzw. cloudflare/worker.js:
// GET/PUT {syncUrl}/state mit Authorization: Bearer <token>, last-write-wins über updatedAt.

sealed class SyncResult {
  data class Ok(val body: JSONObject, val status: Int) : SyncResult()
  data class Error(val message: String) : SyncResult()
}

object SyncClient {

  private fun base(url: String) = url.trim().trimEnd('/')

  private fun headers(token: String): Map<String, String> {
    val h = mutableMapOf("Content-Type" to "application/json")
    if (token.isNotBlank()) h["Authorization"] = "Bearer $token"
    return h
  }

  suspend fun getState(url: String, token: String): SyncResult = withContext(Dispatchers.IO) {
    try {
      val conn = (URL("${base(url)}/state").openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 10000
        readTimeout = 10000
        headers(token).forEach { (k, v) -> setRequestProperty(k, v) }
      }
      val status = conn.responseCode
      val body = conn.inputStream?.bufferedReader()?.readText() ?: ""
      conn.disconnect()
      if (status == 404) return@withContext SyncResult.Ok(JSONObject(), 404)
      if (status == 401 || status == 403) return@withContext SyncResult.Error("token")
      if (status !in 200..299) return@withContext SyncResult.Error("HTTP $status")
      SyncResult.Ok(JSONObject(body), status)
    } catch (e: Exception) {
      SyncResult.Error(e.message ?: "offline")
    }
  }

  suspend fun putState(url: String, token: String, stateJson: JSONObject): SyncResult = withContext(Dispatchers.IO) {
    try {
      val conn = (URL("${base(url)}/state").openConnection() as HttpURLConnection).apply {
        requestMethod = "PUT"
        doOutput = true
        connectTimeout = 10000
        readTimeout = 10000
        headers(token).forEach { (k, v) -> setRequestProperty(k, v) }
      }
      OutputStreamWriter(conn.outputStream).use { it.write(stateJson.toString()) }
      val status = conn.responseCode
      val body = try { conn.inputStream?.bufferedReader()?.readText() ?: "" } catch (e: Exception) { "" }
      conn.disconnect()
      when {
        status == 401 || status == 403 -> SyncResult.Error("token")
        status == 409 -> SyncResult.Ok(JSONObject(if (body.isNotBlank()) body else "{}"), 409)
        status !in 200..299 -> SyncResult.Error("HTTP $status")
        else -> SyncResult.Ok(JSONObject(if (body.isNotBlank()) body else "{}"), status)
      }
    } catch (e: Exception) {
      SyncResult.Error(e.message ?: "offline")
    }
  }
}
