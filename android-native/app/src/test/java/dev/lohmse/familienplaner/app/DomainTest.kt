package dev.lohmse.familienplaner.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DomainTest {

  @Test fun osternBekannteDaten() {
    assertEquals("2027-03-28", toKey(ostern(2027)))
    assertEquals("2028-04-16", toKey(ostern(2028)))
    assertEquals("2030-04-21", toKey(ostern(2030)))
  }

  @Test fun feiertageSachsen2027() {
    val f = feiertageSachsen(2027, false).associate { it.key to it.name }
    assertEquals("Karfreitag", f["2027-03-26"])
    assertEquals("Ostermontag", f["2027-03-29"])
    assertEquals("Christi Himmelfahrt", f["2027-05-06"])
    assertEquals("Pfingstmontag", f["2027-05-17"])
    assertEquals("Buß- und Bettag", f["2027-11-17"])
    assertEquals("Reformationstag", f["2027-10-31"])
    assertEquals(11, f.size)
    val mit = feiertageSachsen(2027, true)
    assertEquals(12, mit.size)
    assertEquals("2027-05-27", mit.first { it.name.startsWith("Fronleichnam") }.key)
  }

  @Test fun halbtagUndWerktag() {
    assertTrue(istHalbtag("2027-12-24", 2027))
    assertTrue(istHalbtag("2027-12-31", 2027))
    assertFalse(istHalbtag("2027-12-23", 2027))
    assertTrue(isWerktag("2027-08-02")) // Mo
    assertFalse(isWerktag("2027-08-07")) // Sa
  }

  @Test fun urlaubstageBerechnung() {
    val fmap = feiertagMap(2027, false)
    assertEquals(5.0, urlaubstageImJahr("2027-08-02", "2027-08-06", 2027, fmap), 0.001) // Mo–Fr
    assertEquals(0.5, urlaubstageImJahr("2027-12-24", "2027-12-24", 2027, fmap), 0.001) // halber Tag
    assertEquals(0.0, urlaubstageImJahr("2027-10-31", "2027-10-31", 2027, fmap), 0.001) // Reformationstag
    assertEquals(10.0, urlaubstageImJahr("2027-08-02", "2027-08-15", 2027, fmap), 0.001) // 2 Wochen Mo–Fr
  }

  @Test fun kwBerechnung() {
    assertEquals(1, isoKW("2027-01-04"))
    assertEquals(53, isoKW("2026-12-28"))
    assertEquals(1, isoKW("2028-01-03"))
  }

  @Test fun datumsHelfer() {
    assertEquals("2028-01-01", addDaysKey("2027-12-31", 1))
    assertEquals(31, daysBetween("2027-12-01", "2027-12-31"))
    assertEquals("1.2.2027", fmtDeutsch("2027-02-01"))
  }

  @Test fun bloeckeZusammenfassen() {
    val fmap = feiertagMap(2027, false)
    val mitWochenendeDazwischen = mergeBloecke(listOf("2027-08-02" to "2027-08-06", "2027-08-09" to "2027-08-13"), fmap)
    assertEquals(1, mitWochenendeDazwischen.size) // nur Sa/So dazwischen -> ein Block
    assertEquals("2027-08-02" to "2027-08-13", mitWochenendeDazwischen.first())
    val mitWerktagDazwischen = mergeBloecke(listOf("2027-08-02" to "2027-08-04", "2027-08-09" to "2027-08-13"), fmap)
    assertEquals(2, mitWerktagDazwischen.size) // Do/Fr 05./06.08. sind Werktage -> zwei Blöcke
  }

  @Test fun bloeckeForUndVerbrauch() {
    val s = defaultState()
    s.jahr = 2027
    s.eintraege.add(Eintrag("e1", "m1", "urlaub", "2027-08-02", "2027-08-06"))
    val bloecke = bloeckeFor(s, "m1", "urlaub", 2027)
    assertEquals(1, bloecke.size)
    assertEquals(5.0, bloecke[0].urlaubstage, 0.001)
    assertEquals(5, bloecke[0].kalendertage)
    assertEquals(5.0, urlaubVerbraucht(s, "m1", 2027), 0.001)
    assertTrue(schulfreieTageKind(s, "m3", 2027) > 0)
  }

  @Test fun jaehrlicheEintraegeImJahr() {
    val s = defaultState()
    s.jahr = 2028
    s.eintraege.add(Eintrag("e1", "m3", "termin", "2027-05-10", "2027-05-10", titel = "Geburtstag", jaehrlich = true, monat = 5, tag = 10))
    val imJahr = eintraegeImJahr(s, 2028).filter { it.id == "e1" }
    assertEquals(1, imJahr.size)
    assertEquals("2028-05-10", imJahr[0].von)
  }

  @Test fun ferienAm() {
    val s = defaultState()
    assertTrue(ferienAm("2027-07-15", s).any { it.contains("Sommerferien") })
    assertTrue(ferienAm("2027-09-15", s).isEmpty())
  }
}
