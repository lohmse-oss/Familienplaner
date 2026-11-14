package dev.lohmse.familienplaner.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainViewModel(app: Application) : AndroidViewModel(app) {

  var state by mutableStateOf(StateStore.load(app))
    private set

  var syncStatus by mutableStateOf("Sync nicht konfiguriert")
    private set
  var syncState by mutableStateOf(SyncUiState.Idle)
    private set

  var auswahl by mutableStateOf(setOf<String>())
    private set
  var auswahlAnker by mutableStateOf<Pair<String, String>?>(null) // memberId|key
    private set
  var auswahlKommentar by mutableStateOf("")
  var nurArbeitstage by mutableStateOf(false)

  var eintragDialog by mutableStateOf<Eintrag?>(null)
    private set
  var neuerEintrag by mutableStateOf(false)
    private set
  var tagDialogKey by mutableStateOf<String?>(null)
    private set
  var einstellDialogOffen by mutableStateOf(false)
    private set

  private var pushJob: Job? = null

  init {
    if (state.einstellungen.geraetName.isBlank()) {
      state.einstellungen.geraetName = "Gerät-" + (1000..9999).random()
      persist()
    }
    viewModelScope.launch {
      while (isActive) {
        delay(20000)
        if (syncEnabled()) pull()
      }
    }
    viewModelScope.launch { if (syncEnabled()) pull() }
  }

  private fun ctx() = getApplication<Application>()

  private fun syncEnabled() = state.einstellungen.syncUrl.isNotBlank()

  private fun persist() = StateStore.save(ctx(), state)

  fun commit(mutate: AppState.() -> Unit = {}) {
    state.mutate()
    state = state.copy()
    persist()
    schedulePush()
  }

  private fun schedulePush(immediate: Boolean = false) {
    if (!syncEnabled()) return
    pushJob?.cancel()
    pushJob = viewModelScope.launch {
      delay(if (immediate) 200 else 1200)
      push()
    }
  }

  private suspend fun push() {
    if (!syncEnabled()) return
    val e = state.einstellungen
    state.updatedAt = System.currentTimeMillis()
    state.updatedBy = e.geraetName.ifBlank { "unbekannt" }
    persist()
    when (val r = SyncClient.putState(e.syncUrl, e.syncToken, StateStore.toJson(state))) {
      is SyncResult.Ok -> {
        if (r.status == 409) pull()
        else { syncState = SyncUiState.Ok; syncStatus = "gesichert (gerade eben)" }
      }
      is SyncResult.Error -> {
        syncState = if (r.message == "token") SyncUiState.Token else SyncUiState.Offline
        syncStatus = if (r.message == "token") "Sync-Token ungültig" else "offline – Änderungen lokal"
      }
    }
  }

  suspend fun pull() {
    if (!syncEnabled()) return
    val e = state.einstellungen
    when (val r = SyncClient.getState(e.syncUrl, e.syncToken)) {
      is SyncResult.Ok -> {
        if (r.status == 404) { schedulePush(true); return }
        val remote = r.body
        val remoteTs = remote.optLong("updatedAt", 0)
        if (remoteTs > state.updatedAt) {
          state = StateStore.fromJson(remote)
          persist()
        }
        val by = remote.optString("updatedBy", "")
        syncState = SyncUiState.Ok
        syncStatus = "aktuell" + (if (by.isNotBlank()) " · $by" else "")
      }
      is SyncResult.Error -> {
        syncState = if (r.message == "token") SyncUiState.Token else SyncUiState.Offline
        syncStatus = if (r.message == "token") "Sync-Token ungültig" else "offline – Änderungen lokal"
      }
    }
  }

  fun syncNow() = viewModelScope.launch { push(); pull() }

  // ---------- Auswahl / Markieren (Wandkalender) ----------

  fun toggleAuswahl(mitgliedId: String, key: String) {
    val id = "$mitgliedId|$key"
    auswahl = if (id in auswahl) auswahl - id else auswahl + id
    auswahlAnker = id to key
  }

  fun selectRow(key: String) {
    val neu = state.mitglieder.flatMap { m -> listOf("${m.id}|$key") }.toSet()
    auswahl = if (auswahl == neu) setOf() else neu
    auswahlAnker = state.mitglieder.firstOrNull()?.let { it.id to key }
  }

  fun clearAuswahl() { auswahl = setOf(); auswahlAnker = null; auswahlKommentar = "" }

  fun markiereAuswahl() {
    val fmap = feiertagMap(state.jahr, state.einstellungen.fronleichnamRegional)
    val proMitglied = auswahl.mapNotNull { it.split("|").takeIf { p -> p.size == 2 }?.let { it[0] to it[1] } }
      .groupBy({ it.first }, { it.second })
    for ((mid, keys) in proMitglied) {
      if (state.mitglieder.none { it.id == mid }) continue
      val m = state.mitglieder.first { it.id == mid }
      val typ = state.wandModus[mid] ?: if (m.rolle == "kind") "schulfrei" else "urlaub"
      val sortiert = keys.sorted()
      val segmente = mutableListOf<Pair<String, String>>()
      var segStart: String? = null
      var prev: String? = null
      fun flush() { segStart?.let { s -> segmente.add(s to (prev ?: s)) }; segStart = null }
      for (k in sortiert) {
        if (typ == "urlaub" && nurArbeitstage && (!isWerktag(k) || fmap[k] != null)) { flush(); continue }
        if (segStart != null && addDaysKey(prev!!, 1) == k) prev = k
        else { flush(); segStart = k; prev = k }
      }
      flush()
      for ((von, bis) in segmente) {
        val e = Eintrag(uid(), mid, typ, von, bis, auswahlKommentar, "")
        state.eintraege.add(e)
      }
    }
    clearAuswahl()
    commit()
  }

  // ---------- Einträge ----------

  fun openNewEintrag() { neuerEintrag = true }
  fun openEditEintrag(e: Eintrag) { eintragDialog = e }
  fun closeEintragDialog() { eintragDialog = null }
  fun neuerEintragSchliessen() { neuerEintrag = false }
  fun openTagDialog(key: String) { tagDialogKey = key }
  fun closeTagDialog() { tagDialogKey = null }
  fun openEinstellungen() { einstellDialogOffen = true }
  fun closeEinstellungen() { einstellDialogOffen = false }

  fun saveEintrag(e: Eintrag) {
    commit {
      val idx = eintraege.indexOfFirst { it.id == e.id }
      if (idx >= 0) eintraege[idx] = e else eintraege.add(e)
    }
    eintragDialog = null
    neuerEintrag = false
  }

  fun deleteEintrag(id: String) {
    commit { eintraege.removeAll { it.id == id } }
    if (tagDialogKey != null) tagDialogKey = tagDialogKey // Dialog rendert neu
  }

  // ---------- Einstellungen ----------

  fun setAnsicht(a: String) = commit { ansicht = a }
  fun setJahr(j: Int) = commit { jahr = j }

  fun exportJsonText(): String = StateStore.toExportJson(state).toString(2)

  fun importJsonText(text: String) {
    val data = JSONObject(text)
    if (!data.has("eintraege")) throw IllegalArgumentException("ungültig")
    commit { /* noop – State gesetzt unten */ }
    state = StateStore.importJson(ctx(), state, data)
    persist()
    schedulePush(true)
  }

  private fun uid(): String =
    "e" + System.currentTimeMillis().toString(36) + (100..999).random()
}

enum class SyncUiState { Idle, Ok, Offline, Token }
