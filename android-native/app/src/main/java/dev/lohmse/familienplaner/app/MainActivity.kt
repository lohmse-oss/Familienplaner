package dev.lohmse.familienplaner.app

import android.app.Application
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {

  private lateinit var vm: MainViewModel

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    vm = ViewModelProvider(this)[MainViewModel::class.java]
    setContent {
      FamilienplanerTheme {
        val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
          uri?.let {
            try {
              val text = contentResolver.openInputStream(it)?.bufferedReader()?.readText()
              if (text != null) {
                vm.importJsonText(text)
                Toast.makeText(this, "Import erfolgreich.", Toast.LENGTH_SHORT).show()
              }
            } catch (e: Exception) {
              Toast.makeText(this, "Import fehlgeschlagen: ${e.message}", Toast.LENGTH_LONG).show()
            }
          }
        }
        App(
          vm = vm,
          onExport = {
            val intent = Intent(Intent.ACTION_SEND).apply {
              type = "application/json"
              putExtra(Intent.EXTRA_TEXT, vm.exportJsonText())
              putExtra(Intent.EXTRA_SUBJECT, "familienplaner-${vm.state.jahr}.json")
            }
            startActivity(Intent.createChooser(intent, "JSON exportieren"))
          },
          onImport = { importLauncher.launch(arrayOf("application/json", "text/plain", "*/*")) }
        )
      }
    }
  }
}

fun fmtZahl(d: Double): String {
  var s = String.format("%.1f", d)
  if (s.contains('.')) s = s.trimEnd('0').trimEnd('.')
  return s
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun App(vm: MainViewModel = viewModel(), onExport: () -> Unit, onImport: () -> Unit) {
  var menuOffen by remember { mutableStateOf(false) }
  var jahrMenu by remember { mutableStateOf(false) }

  Scaffold(
    topBar = {
      TopAppBar(
        title = {
          Column {
            Text("📅 Familien-Jahresplaner")
            Text(
              vm.syncStatus,
              style = MaterialTheme.typography.labelSmall,
              color = when (vm.syncState) {
                SyncUiState.Ok -> Color(0xFF16A34A)
                SyncUiState.Token -> Color(0xFFDC2626)
                SyncUiState.Offline -> Color(0xFFD97706)
                SyncUiState.Idle -> MaterialTheme.colorScheme.onSurfaceVariant
              }
            )
          }
        },
        actions = {
          Box {
            TextButton(onClick = { jahrMenu = true }) { Text("Jahr: ${vm.state.jahr} ▾") }
            DropdownMenu(expanded = jahrMenu, onDismissRequest = { jahrMenu = false }) {
              for (j in JAHR_MIN..JAHR_MAX) {
                DropdownMenuItem(text = { Text("$j") }, onClick = { vm.setJahr(j); jahrMenu = false })
              }
            }
          }
          IconButton(onClick = { vm.openNewEintrag() }) { Icon(Icons.Default.Add, contentDescription = "Neuer Eintrag") }
          Box {
            IconButton(onClick = { menuOffen = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Menü") }
            DropdownMenu(expanded = menuOffen, onDismissRequest = { menuOffen = false }) {
              Text("Ansicht", modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              for ((id, label) in listOf("wand" to "Wandkalender", "monate" to "Monatsansicht", "liste" to "Urlaubsliste", "alle" to "Alle Einträge")) {
                DropdownMenuItem(
                  text = { Text((if (vm.state.ansicht == id) "✓ " else "") + label) },
                  onClick = { vm.setAnsicht(id); menuOffen = false }
                )
              }
              HorizontalDivider()
              Text("Datei", modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              DropdownMenuItem(text = { Text("JSON exportieren") }, onClick = { menuOffen = false; onExport() })
              DropdownMenuItem(text = { Text("JSON importieren") }, onClick = { menuOffen = false; onImport() })
              HorizontalDivider()
              Text("Extras", modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              DropdownMenuItem(text = { Text("Einstellungen") }, onClick = { menuOffen = false; vm.openEinstellungen() })
              DropdownMenuItem(text = { Text("Jetzt synchronisieren") }, onClick = { menuOffen = false; vm.syncNow() })
            }
          }
        }
      )
    }
  ) { padding ->
    Column(Modifier.padding(padding)) {
      Uebersicht(vm)
      Box(Modifier.weight(1f)) {
        when (vm.state.ansicht) {
          "monate" -> MonateView(vm)
          "liste" -> ListeView(vm)
          "alle" -> AlleView(vm)
          else -> WandView(vm)
        }
      }
    }
  }

  if (vm.neuerEintrag || vm.eintragDialog != null) {
    EintragDialog(vm, existing = vm.eintragDialog)
  }
  vm.tagDialogKey?.let { key -> TagDialog(vm, key) }
  if (vm.einstellDialogOffen) EinstellungenDialog(vm)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Uebersicht(vm: MainViewModel) {
  val s = vm.state
  val jahr = s.jahr
  FlowRow(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    for (m in s.mitglieder) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
      ) {
        Column(Modifier.padding(10.dp)) {
          Text(m.name, fontWeight = FontWeight.Bold)
          if (m.rolle == "elternteil") {
            val verbraucht = urlaubVerbraucht(s, m.id, jahr)
            val verfuegbar = m.urlaubstage + m.resturlaubVorjahr
            Text("Urlaub: ${fmtZahl(verbraucht)} von $verfuegbar verbraucht (${fmtZahl((verfuegbar - verbraucht).toDouble())} übrig)")
            if (m.resturlaubVorjahr > 0 && heuteKey() <= "$jahr-03-31") {
              Text("⚠️ ${m.resturlaubVorjahr} Resturlaubstage bis 31.03. offen", color = Color(0xFFB91C1C), style = MaterialTheme.typography.bodySmall)
            }
          } else {
            Text("schulfreie Tage ${jahr}: ${schulfreieTageKind(s, m.id, jahr)}")
          }
        }
      }
    }
  }
}
