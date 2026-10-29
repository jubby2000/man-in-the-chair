# Attribution

## Bundled SRD data

The compendium data in `src/data/srd/` is normalized (see
`scripts/normalize-srd.mjs`) from:

- **5e-bits/5e-database** — https://github.com/5e-bits/5e-database
  Licensed under the **MIT License**. This project supplies the structured JSON
  from which the SRD content is derived.

## Game content

### SRD 5.1 (the `srd51` dataset)

> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is
> licensed under the **Creative Commons Attribution 4.0 International License**
> available at https://creativecommons.org/licenses/by/4.0/legalcode.

### SRD 5.2 (the `srd52` dataset)

> This work includes material from the System Reference Document 5.2 ("SRD 5.2")
> by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd, licensed under the
> **Creative Commons Attribution 4.0 International License**
> (https://creativecommons.org/licenses/by/4.0/legalcode).

Dungeons & Dragons is a trademark of Wizards of the Coast. This project is
unofficial fan content and is not affiliated with or endorsed by Wizards of
the Coast.

## Sample campaign

The sample campaign (`src/lib/sampleSeed.ts`) is SRD 5.1 content referenced by
id plus original writing made for this project. It is covered by the
repository's AGPL-3.0 license like the rest of the code.

## Compatible import format

The XML importer targets the schema used by **FightClub5eXML** —
https://github.com/ogre-project/FightClub5eXML. That repository and the
collections it hosts are maintained independently; no content from it is
bundled with this application.
