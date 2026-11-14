package dev.lohmse.familienplaner.app

import android.app.DatePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> SelectField(
  label: String,
  value: T,
  options: List<T>,
  labelOf: (T) -> String,
  onChange: (T) -> Unit,
  modifier: Modifier = Modifier
) {
  var expanded by remember { mutableStateOf(false) }
  ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }, modifier = modifier) {
    OutlinedTextField(
      value = labelOf(value),
      onValueChange = {},
      readOnly = true,
      label = { Text(label) },
      trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
      modifier = Modifier.menuAnchor().fillMaxWidth()
    )
    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
      options.forEach { o ->
        DropdownMenuItem(text = { Text(labelOf(o)) }, onClick = { onChange(o); expanded = false })
      }
    }
  }
}

@Composable
fun DateField(label: String, value: String, onPick: (String) -> Unit, modifier: Modifier = Modifier) {
  var show by remember { mutableStateOf(false) }
  Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
    OutlinedTextField(value = value, onValueChange = onPick, label = { Text(label) }, singleLine = true, modifier = Modifier.weight(1f))
    IconButton(onClick = { show = true }) { Icon(Icons.Default.CalendarMonth, contentDescription = "Datum wählen") }
  }
  if (show) {
    val c = if (value.length >= 10) fromKey(value) else Calendar.getInstance()
    DatePickerDialog(
      LocalContext.current,
      { _, y, m, d -> onPick("$y-${pad(m + 1)}-${pad(d)}"); show = false },
      c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)
    ).show()
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EintragDialog(vm: MainViewModel, existing: Eintrag?) {
  val s = vm.state
  val init = existing ?: Eintrag(
    id = "", mitgliedId = s.mitglieder.firstOrNull()?.id ?: "",
    typ = "termin", von = vm.tagDialogKey ?: heuteKey(), bis = vm.tagDialogKey ?: heuteKey()
  )
  var mitgliedId by remember(existing) { mutableStateOf(init.mitgliedId) }
  var typ by remember(existing) { mutableStateOf(init.typ) }
  var von by remember(existing) { mutableStateOf(init.von) }
  var bis by remember(existing) { mutableStateOf(init.bis) }
  var titel by remember(existing) { mutableStateOf(init.titel) }
  var notiz by remember(existing) { mutableStateOf(init.notiz) }
  var jaehrlich by remember(existing) { mutableStateOf(init.jaehrlich) }

  val mitglied = s.mitglieder.find { it.id == mitgliedId } ?: s.mitglieder.first()
  val typOptionen = MODUS_OPTIONEN[mitglied.rolle] ?: MODUS_OPTIONEN["elternteil"]!!
  if (typ !in typOptionen) typ = typOptionen.first()

  AlertDialog(
    onDismissRequest = { vm.closeEintragDialog(); vm.neuerEintragSchliessen() },
    title = { Text(if (existing == null) "Neuer Eintrag" else "Eintrag bearbeiten") },
    text = {
      Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SelectField("Person", mitglied, s.mitglieder, { it.name }, { mitgliedId = it.id; typ = (MODUS_OPTIONEN[it.rolle] ?: listOf("termin")).first() })
        SelectField("Art", typ, typOptionen, { typLabel(it) }, { typ = it })
        DateField("Von", von, { von = it })
        DateField("Bis (einschließlich)", bis, { bis = it })
        OutlinedTextField(titel, { titel = it }, label = { Text("Titel (z. B. Sommerurlaub)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(notiz, { notiz = it }, label = { Text("Notiz") }, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
          Checkbox(jaehrlich, { jaehrlich = it })
          Text("Jährlich wiederkehrend (z. B. Geburtstag)", style = MaterialTheme.typography.bodySmall)
        }
      }
    },
    confirmButton = {
      TextButton(onClick = {
        val vonCal = fromKey(von)
        val e = Eintrag(
          id = if (existing?.id?.isNotBlank() == true) existing.id else "e" + System.currentTimeMillis().toString(36) + (100..999).random(),
          mitgliedId = mitgliedId, typ = typ,
          von = if (jaehrlich) "${vonCal.get(Calendar.YEAR)}-${pad(vonCal.get(Calendar.MONTH) + 1)}-${pad(vonCal.get(Calendar.DAY_OF_MONTH))}" else von,
          bis = bis, titel = titel.trim(), notiz = notiz.trim(), jaehrlich = jaehrlich,
          monat = if (jaehrlich) vonCal.get(Calendar.MONTH) + 1 else null,
          tag = if (jaehrlich) vonCal.get(Calendar.DAY_OF_MONTH) else null,
          gcalId = existing?.gcalId
        )
        vm.saveEintrag(e)
      }) { Text("Speichern") }
    },
    dismissButton = { TextButton(onClick = { vm.closeEintragDialog(); vm.neuerEintragSchliessen() }) { Text("Abbrechen") } }
  )
}

@Composable
fun TagDialog(vm: MainViewModel, key: String) {
  val s = vm.state
  val jahr = key.substring(0, 4).toInt()
  val fmap = feiertagMap(jahr, s.einstellungen.fronleichnamRegional)
  val entries = eintraegeAmDay(s, key)
  AlertDialog(
    onDismissRequest = { vm.closeTagDialog() },
    title = { Text("${wochentagKurz(key)} ${fmtDeutsch(key)}${if (istHalbtag(key, jahr)) " (½)" else ""}") },
    text = {
      Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        fmap[key]?.let { Text("Feiertag: $it", color = androidx.compose.ui.graphics.Color(0xFFB91C1C), fontWeight = FontWeight.Bold) }
        ferienAm(key, s).forEach { Text("Ferien: $it", color = androidx.compose.ui.graphics.Color(0xFF9A3412)) }
        if (entries.isEmpty()) Text("Keine Einträge an diesem Tag.")
        entries.forEach { e ->
          val m = s.mitglieder.find { it.id == e.mitgliedId }
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
            Text("${m?.name ?: "?"} · ${typLabel(e.typ)}${if (e.jaehrlich) " (jährlich)" else ""}${if (e.titel.isNotBlank()) " – ${e.titel}" else ""}${if (e.von != e.bis) " (${fmtDeutsch(e.von)}–${fmtDeutsch(e.bis)})" else ""}", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
            IconButton(onClick = { vm.openEditEintrag(e); vm.closeTagDialog() }) { Icon(Icons.Default.Edit, contentDescription = "Bearbeiten") }
            IconButton(onClick = { vm.deleteEintrag(e.id) }) { Icon(Icons.Default.Delete, contentDescription = "Löschen") }
          }
        }
      }
    },
    confirmButton = {
      TextButton(onClick = { vm.openNewEintrag(); vm.closeTagDialog() }) { Text("+ Eintrag an diesem Tag") }
    },
    dismissButton = { TextButton(onClick = { vm.closeTagDialog() }) { Text("Schließen") } }
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EinstellungenDialog(vm: MainViewModel) {
  val s = vm.state
  var efName by remember { mutableStateOf("") }
  var efVon by remember { mutableStateOf("") }
  var efBis by remember { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = { vm.closeEinstellungen() },
    title = { Text("Einstellungen") },
    text = {
      LazyColumn(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Personen", fontWeight = FontWeight.Bold) }
        items(s.mitglieder.size, key = { s.mitglieder[it].id }) { i ->
          val m = s.mitglieder[i]
          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            OutlinedTextField(m.name, { vm.commit { s.mitglieder[i].name = it } }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              OutlinedTextField(m.farbe, { vm.commit { s.mitglieder[i].farbe = it } }, label = { Text("Farbe") }, singleLine = true, modifier = Modifier.weight(1f))
              SelectField("Rolle", m.rolle, listOf("elternteil", "kind"), { if (it == "elternteil") "Elternteil" else "Kind" }, { vm.commit { s.mitglieder[i].rolle = it } }, modifier = Modifier.weight(1f))
            }
            if (m.rolle == "elternteil") {
              Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(m.urlaubstage.toString(), { v -> vm.commit { s.mitglieder[i].urlaubstage = v.toIntOrNull() ?: 0 } }, label = { Text("Urlaubstage") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(m.resturlaubVorjahr.toString(), { v -> vm.commit { s.mitglieder[i].resturlaubVorjahr = v.toIntOrNull() ?: 0 } }, label = { Text("Rest-VJ") }, singleLine = true, modifier = Modifier.weight(1f))
              }
            }
          }
        }
        item { Text("Schulferien manuell ergänzen", fontWeight = FontWeight.Bold) }
        items(s.eigeneFerien, key = { "${it.von}|${it.name}" }) { f ->
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${f.name} (${fmtDeutsch(f.von)} – ${fmtDeutsch(f.bis)})", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { vm.commit { s.eigeneFerien.removeAll { it == f } } }) { Text("Löschen") }
          }
        }
        item {
          OutlinedTextField(efName, { efName = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
          DateField("Von", efVon, { efVon = it })
          DateField("Bis", efBis, { efBis = it })
          TextButton(onClick = {
            if (efName.isNotBlank() && efVon.length >= 10 && efBis.length >= 10 && efBis >= efVon) {
              vm.commit { s.eigeneFerien.add(Ferien(efName.trim(), efVon, efBis)) }
              efName = ""; efVon = ""; efBis = ""
            }
          }) { Text("Ferien hinzufügen") }
        }
        item { Text("Sonstiges", fontWeight = FontWeight.Bold) }
        item {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(s.einstellungen.fronleichnamRegional, { vm.commit { s.einstellungen.fronleichnamRegional = it } })
            Text("Fronleichnam als Feiertag (sorbische Gemeinden)", style = MaterialTheme.typography.bodySmall)
          }
        }
        item { Text("Familien-Sync (gemeinsame Nutzung)", fontWeight = FontWeight.Bold) }
        item { OutlinedTextField(s.einstellungen.syncUrl, { vm.commit { s.einstellungen.syncUrl = it } }, label = { Text("Sync-Server-URL") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(s.einstellungen.syncToken, { vm.commit { s.einstellungen.syncToken = it } }, label = { Text("Sync-Token") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(s.einstellungen.geraetName, { vm.commit { s.einstellungen.geraetName = it } }, label = { Text("Name dieses Geräts") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { TextButton(onClick = { vm.syncNow() }) { Text("Jetzt synchronisieren") } }
      }
    },
    confirmButton = { TextButton(onClick = { vm.closeEinstellungen() }) { Text("Fertig") } }
  )
}
