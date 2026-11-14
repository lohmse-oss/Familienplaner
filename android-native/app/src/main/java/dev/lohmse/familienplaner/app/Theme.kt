package dev.lohmse.familienplaner.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

@Composable
fun FamilienplanerTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = lightColorScheme(
      primary = androidx.compose.ui.graphics.Color(0xFF2563EB),
      background = androidx.compose.ui.graphics.Color(0xFFF8FAFC),
      surface = androidx.compose.ui.graphics.Color(0xFFFFFFFF)
    ),
    content = content
  )
}
