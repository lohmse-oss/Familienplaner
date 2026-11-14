package dev.lohmse.familienplaner.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Button
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.Calendar
import java.util.GregorianCalendar

val FERIEN_BG = Color(0xFFFFEDD5)
val FEIERTAG_BG = Color(0xFFFEE2E2)
val WOCHENENDE_BG = Color(0xFFF1F5F9)
val SCHULFREI_RING = Color(0xFF60A5FA)

fun eintraegeAmDay(s: AppState, key: String): List<Eintrag> {
  val jahr = key.substring(0, 4).toInt()
  return eintraegeImJahr(s, jahr).filter { it.von <= key && it.bis >= key }
}

fun colorOf(hex: String): Color = try { Color(android.graphics.Color.parseColor(hex)) } catch (e: Exception) { Color.Gray }

// ---------- Wandkalender ----------

@Composable
fun WandView(vm: MainViewModel) {
  val s = vm.state
  val fmap = remember(s.jahr, s.einstellungen.fronleichnamRegional) { feiertagMap(s.jahr, s.einstellungen.fronleichnamRegional) }

  Column {
    if (vm.auswahl.isNotEmpty()) {
      Card(modifier = Modifier.fillMaxWidth().padding(8.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${vm.auswahl.size} Zellen ausgewählt", fontWeight = FontWeight.Bold)
            OutlinedTextField(
              value = vm.auswahlKommentar,
              onValueChange = { vm.auswahlKommentar = it },
              label = { Text("Titel / Kurznotiz") },
              singleLine = true,
              modifier = Modifier.weight(1f)
            )
          }
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { vm.markiereAuswahl() }) { Text("Markieren") }
            Row(verticalAlignment = Alignment.CenterVertically) {
              Checkbox(checked = vm.nurArbeitstage, onCheckedChange = { vm.nurArbeitstage = it })
              Text("nur Arbeitstage", style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = { vm.clearAuswahl() }) { Text("Aufheben") }
          }
        }
      }
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
      item { WandKopf(s, vm) }
      for (monat in 0..11) {
        item(key = "m$monat") {
          Text("${MONATSNAMEN[monat]} ${s.jahr}", modifier = Modifier.padding(start = 8.dp, top = 10.dp, bottom = 2.dp), fontWeight = FontWeight.Bold)
        }
        val tage = GregorianCalendar(s.jahr, monat + 1, 0).get(Calendar.DAY_OF_MONTH)
        for (tag in 1..tage) {
          val key = "${s.jahr}-${pad(monat + 1)}-${pad(tag)}"
          item(key = key) { TagZeile(vm, key, fmap) }
        }
      }
    }
  }
}

@Composable
fun WandKopf(s: AppState, vm: MainViewModel) {
  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).background(Color.White).padding(vertical = 4.dp, horizontal = 8.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text("Datum", modifier = Modifier.width(76.dp), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
    Text("", modifier = Modifier.width(110.dp))
    for (m in s.mitglieder) {
      var offen by remember { mutableStateOf(false) }
      Box(modifier = Modifier.width(96.dp).border(2.dp, colorOf(m.farbe)).padding(2.dp)) {
        Column {
          Text(m.name, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
          val akt = s.wandModus[m.id] ?: if (m.rolle == "kind") "schulfrei" else "urlaub"
          Box {
            TextButton(onClick = { offen = true }, modifier = Modifier.height(28.dp)) { Text(typLabel(akt), style = MaterialTheme.typography.labelSmall) }
            androidx.compose.material3.DropdownMenu(expanded = offen, onDismissRequest = { offen = false }) {
              for (v in (MODUS_OPTIONEN[m.rolle] ?: MODUS_OPTIONEN["elternteil"]!!)) {
                androidx.compose.material3.DropdownMenuItem(text = { Text(typLabel(v)) }, onClick = { vm.commit { wandModus[m.id] = v }; offen = false })
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun TagZeile(vm: MainViewModel, key: String, fmap: Map<String, String>) {
  val s = vm.state
  val jahr = key.substring(0, 4).toInt()
  val feiertag = fmap[key]
  val ferien = ferienAm(key, s)
  val dow = (fromKey(key).get(Calendar.DAY_OF_WEEK) + 6) % 7
  val wochenende = dow >= 5
  val halb = istHalbtag(key, jahr)
  val heute = key == heuteKey() && jahr == Calendar.getInstance().get(Calendar.YEAR)

  var bg = Color.Transparent
  if (feiertag != null) bg = FEIERTAG_BG else if (ferien.isNotEmpty()) bg = FERIEN_BG else if (wochenende) bg = WOCHENENDE_BG

  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).background(bg).padding(vertical = 2.dp, horizontal = 8.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    val datumText = "${wochentagKurz(key)} ${fmtDeutsch(key)}${if (halb) " ½" else ""}"
    Text(
      datumText,
      modifier = Modifier.width(76.dp).clickable { vm.selectRow(key) },
      style = MaterialTheme.typography.bodySmall.copy(fontWeight = if (feiertag != null) FontWeight.Bold else FontWeight.Normal, color = if (feiertag != null) Color(0xFFB91C1C) else Color.Unspecified)
    )
    Column(modifier = Modifier.width(110.dp)) {
      if (feiertag != null) Text(feiertag, style = MaterialTheme.typography.labelSmall, color = Color(0xFF991B1B))
      ferien.forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = Color(0xFF9A3412)) }
      if (halb) Text("½", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6D28D9), fontWeight = FontWeight.Bold)
    }
    for (m in s.mitglieder) {
      val entries = eintraegeAmDay(s, key).filter { it.mitgliedId == m.id }
      val sel = "${m.id}|$key" in vm.auswahl
      Box(
        modifier = Modifier
          .width(96.dp)
          .height(34.dp)
          .border(2.dp, if (heute) Color(0xFF2563EB) else colorOf(m.farbe))
          .background(if (sel) Color(0xFFDBEAFE) else Color.Transparent)
          .clickable { vm.toggleAuswahl(m.id, key) }
          .padding(2.dp)
      ) {
        entries.forEach { e ->
          Text(
            "${typLabel(e.typ)}${if (e.jaehrlich) " (jährlich)" else ""}${if (e.titel.isNotBlank()) ": ${e.titel}" else ""}".trim(),
            style = MaterialTheme.typography.labelSmall,
            color = colorOf(m.farbe)
          )
        }
      }
    }
  }
}

// ---------- Monatsansicht ----------

@Composable
fun MonateView(vm: MainViewModel) {
  val s = vm.state
  val fmap = remember(s.jahr, s.einstellungen.fronleichnamRegional) { feiertagMap(s.jahr, s.einstellungen.fronleichnamRegional) }
  LazyColumn(modifier = Modifier.fillMaxSize()) {
    for (monat in 0..11) {
      item(key = "monat-$monat") { MonatKarte(vm, monat, fmap) }
    }
  }
}

@Composable
fun MonatKarte(vm: MainViewModel, monat: Int, fmap: Map<String, String>) {
  val s = vm.state
  val jahr = s.jahr
  val first = GregorianCalendar(jahr, monat, 1)
  val offset = (first.get(Calendar.DAY_OF_WEEK) + 6) % 7 // Mo=0
  val tage = GregorianCalendar(jahr, monat + 1, 0).get(Calendar.DAY_OF_MONTH)
  Card(modifier = Modifier.fillMaxWidth().padding(8.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
    Column(Modifier.padding(8.dp)) {
      Text("${MONATSNAMEN[monat]} $jahr", fontWeight = FontWeight.Bold)
      Row { for (w in WOCHENTAG_KURZ) Text(w, modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = Color.Gray) }
      val cells = List(offset) { null as Int? } + (1..tage).toList()
      for (week in cells.chunked(7)) {
        Row {
          for (i in 0..6) {
            val d = week.getOrNull(i)
            if (d == null) Box(Modifier.weight(1f)) else DayCell(vm, "$jahr-${pad(monat + 1)}-${pad(d)}", fmap)
          }
        }
      }
    }
  }
}

@Composable
fun RowScope.DayCell(vm: MainViewModel, key: String, fmap: Map<String, String>) {
  val s = vm.state
  val jahr = key.substring(0, 4).toInt()
  val feiertag = fmap[key]
  val ferien = ferienAm(key, s)
  val dow = (fromKey(key).get(Calendar.DAY_OF_WEEK) + 6) % 7
  val entries = eintraegeAmDay(s, key)
  val schulfrei = entries.any { it.typ == "schulfrei" }
  var bg = Color.Transparent
  if (feiertag != null) bg = FEIERTAG_BG else if (ferien.isNotEmpty()) bg = FERIEN_BG else if (dow >= 5) bg = WOCHENENDE_BG
  Box(
    modifier = Modifier
      .weight(1f)
      .height(44.dp)
      .background(bg)
      .border(if (schulfrei) 1.dp else 0.dp, SCHULFREI_RING)
      .clickable { vm.openTagDialog(key) }
      .padding(1.dp)
  ) {
    val c = fromKey(key)
    Text("${c.get(Calendar.DAY_OF_MONTH)}${if (istHalbtag(key, jahr)) "½" else ""}", style = MaterialTheme.typography.labelSmall, color = if (feiertag != null) Color(0xFFB91C1C) else Color.Unspecified)
    entries.take(3).forEach { e ->
      val m = s.mitglieder.find { it.id == e.mitgliedId }
      Box(Modifier.height(4.dp).fillMaxWidth().background(colorOf(m?.farbe ?: "#666")).padding(0.dp))
    }
  }
}

// ---------- Urlaubsliste ----------

@Composable
fun ListeView(vm: MainViewModel) {
  val s = vm.state
  val jahr = s.jahr
  LazyColumn(modifier = Modifier.fillMaxSize().padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    for (m in s.mitglieder) {
      if (m.rolle == "elternteil") {
        val bloecke = bloeckeFor(s, m.id, "urlaub", jahr)
        val gesamt = bloecke.sumOf { it.urlaubstage }
        val verfuegbar = m.urlaubstage + m.resturlaubVorjahr
        item(key = "l-${m.id}") {
          Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.padding(10.dp)) {
              Text("${m.name} – Urlaub $jahr", fontWeight = FontWeight.Bold)
              Text("${fmtZahl(gesamt)} von $verfuegbar Urlaubstagen verbraucht (${fmtZahl((verfuegbar - gesamt).toDouble())} übrig)", style = MaterialTheme.typography.bodySmall)
              if (bloecke.isEmpty()) Text("Noch kein Urlaub eingetragen.", style = MaterialTheme.typography.bodySmall)
              bloecke.forEach { b ->
                Text("${fmtDeutsch(b.von)} – ${fmtDeutsch(b.bis)} · ${b.kalendertage} Kalendertage · ${fmtZahl(b.urlaubstage)} Urlaubstage" + (if (b.ferien.isNotEmpty()) " · ${b.ferien.joinToString(", ")}" else ""), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
              }
            }
          }
        }
      } else {
        val bloecke = bloeckeFor(s, m.id, "schulfrei", jahr)
        if (bloecke.isNotEmpty()) {
          item(key = "l-${m.id}") {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
              Column(Modifier.padding(10.dp)) {
                Text("${m.name} – flexible schulfreie Tage $jahr", fontWeight = FontWeight.Bold)
                bloecke.forEach { b -> Text("${fmtDeutsch(b.von)} – ${fmtDeutsch(b.bis)} · ${b.kalendertage} Kalendertage", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp)) }
              }
            }
          }
        }
      }
    }
  }
}

// ---------- Alle Einträge ----------

@Composable
fun AlleView(vm: MainViewModel) {
  val s = vm.state
  val jahr = s.jahr
  val entries = remember(s.eintraege.toList(), jahr) {
    eintraegeImJahr(s, jahr).filter { it.von <= "$jahr-12-31" && it.bis >= "$jahr-01-01" }.sortedBy { it.von }
  }
  val gruppen = entries.groupBy { it.von.substring(0, 7) }
  LazyColumn(modifier = Modifier.fillMaxSize().padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
    for ((ym, list) in gruppen) {
      item(key = "h$ym") {
        Text("${MONATSNAMEN[ym.substring(5, 7).toInt() - 1]} ${ym.substring(0, 4)}", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp, bottom = 2.dp))
      }
      items(list, key = { it.id }) { e ->
        val m = s.mitglieder.find { it.id == e.mitgliedId }
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth()) {
          Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(4.dp).height(28.dp).background(colorOf(m?.farbe ?: "#666")))
            Column(Modifier.weight(1f)) {
              Text("${fmtDeutsch(e.von)}${if (e.von != e.bis) " – ${fmtDeutsch(e.bis)}" else ""} · ${m?.name ?: "?"} · ${typLabel(e.typ)}${if (e.jaehrlich) " (jährlich)" else ""}${if (e.titel.isNotBlank()) " – ${e.titel}" else ""}")
            }
            TextButton(onClick = { vm.openTagDialog(e.von) }) { Text("Tag") }
            TextButton(onClick = { vm.openEditEintrag(e) }) { Text("Bearbeiten") }
          }
        }
      }
    }
  }
}
