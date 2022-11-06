import fs from "fs/promises";
import xml from "xml-parse";
import * as Ease from "./ease.js";

const len = 10;
const ease = "quadInOut";
const path = "mazerte-atem-macros.xml";
const output = "mazerte-atem-macros-animated.xml";
const animatedProps = {
  SuperSourceV2BoxSize: "size",
  SuperSourceV2BoxXPosition: "xPosition",
  SuperSourceV2BoxYPosition: "yPosition",
  SuperSourceV2BoxMaskLeft: "left",
  SuperSourceV2BoxMaskTop: "top",
  SuperSourceV2BoxMaskRight: "right",
  SuperSourceV2BoxMaskBottom: "bottom",
};

const run = async () => {
  const file = await fs.readFile(path, "utf8");
  const content = xml.parse(file);
  const profile = content.find((n) => (n.tagName = "Profile" && n.closing));
  const macroPool = profile.childNodes.find(
    (n) => (n.tagName = "MacroPool" && n.closing)
  );
  const macros = macroPool.childNodes.filter(
    (n) => (n.tagName = "Macro" && n.closing)
  );
  macros.forEach((m) => (m.tagName = "Macro"));

  const toAnimate = macros.filter((n) => n.attributes.name.indexOf("->") != -1);
  toAnimate.forEach((macro) => {
    const match = macro.attributes.name.match(/^(.*) -> (.*)$/);
    const from = macros.find((m) => m.attributes.name == match[1]);
    const to = macros.find((m) => m.attributes.name == match[2]);

    let allSuperSource = [];
    let allBoxIndex = [];

    let animatedValues = [];
    for (const key in animatedProps) {
      if (Object.hasOwnProperty.call(animatedProps, key)) {
        const fromOps = [
          ...from.childNodes
            .filter((n) => n.tagName == "Op")
            .filter((n) => n.attributes.id == key),
          ...macro.childNodes
            .filter((n) => n.tagName == "Op")
            .filter((n) => n.attributes.__from == "true")
            .filter((n) => n.attributes.id == key),
        ];
        const toOps = [
          ...to.childNodes
            .filter((n) => n.tagName == "Op")
            .filter((n) => n.attributes.id == key),
          ...macro.childNodes
            .filter((n) => n.tagName == "Op")
            .filter((n) => n.attributes.__to == "true")
            .filter((n) => n.attributes.id == key),
        ];
        const superSource = [...fromOps, ...toOps]
          .map((n) => n.attributes.superSource)
          .filter((v, i, a) => a.indexOf(v) === i);
        allSuperSource = [...allSuperSource, ...superSource];
        const boxIndex = [...fromOps, ...toOps]
          .map((n) => n.attributes.boxIndex)
          .filter((v, i, a) => a.indexOf(v) === i);
        allBoxIndex = [...allBoxIndex, ...boxIndex];

        superSource.forEach((ss) => {
          boxIndex.forEach((bi) => {
            const fromOp = fromOps.find(
              (n) =>
                n.attributes.superSource == ss && n.attributes.boxIndex == bi
            );
            const toOp = toOps.find(
              (n) =>
                n.attributes.superSource == ss && n.attributes.boxIndex == bi
            );
            animatedValues.push({
              id: key,
              prop: animatedProps[key],
              superSource: ss,
              boxIndex: bi,
              from: parseFloat(
                (fromOp ? fromOp : toOp).attributes[animatedProps[key]]
              ),
              to: parseFloat(
                (toOp ? toOp : fromOp).attributes[animatedProps[key]]
              ),
            });
          });
        });
      }
    }

    // animatedValues = animatedValues.filter((a) => a.from != a.to);

    macro.attributes.description = "Generated";
    macro.childNodes = [];

    from.childNodes
      .filter((n) => n.tagName == "Op")
      .forEach((op) => macro.childNodes.push(op));

    allSuperSource = allSuperSource.filter((v, i, a) => a.indexOf(v) === i);
    allBoxIndex = allBoxIndex.filter((v, i, a) => a.indexOf(v) === i);
    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 4; j++) {
        const enable =
          allSuperSource.find((e) => e == `${i}`) &&
          allBoxIndex.find((e) => e == `${j}`)
            ? "True"
            : "False";
        const op = `<Op id="SuperSourceV2BoxEnable" superSource="${i}" boxIndex="${j}" enable="${enable}"/>\n`;
        macro.childNodes.push(xml.parse(op)[0]);
      }
    }
    for (let index = 0; index < len; index++) {
      const t = Ease[ease](index / (len - 1));
      animatedValues.forEach((av) => {
        const diff = av.from + (av.to - av.from) * t;
        const op = `<Op id="${av.id}" superSource="${av.superSource}" boxIndex="${av.boxIndex}" ${av.prop}="${diff}"/>\n`;
        macro.childNodes.push(xml.parse(op)[0]);
      });
      macro.childNodes.push(xml.parse('<Op id="MacroSleep" frames="1"/>')[0]);
    }
    to.childNodes
      .filter((n) => n.tagName == "Op")
      .forEach((op) => macro.childNodes.push(op));

    macro.childNodes.forEach((n) => (n.closing = true));
  });

  content[0].tagName = "?xml";
  profile.tagName = "Profile";
  macroPool.tagName = "MacroPool";
  fs.writeFile(output, xml.stringify(content, 2));
};
run();
