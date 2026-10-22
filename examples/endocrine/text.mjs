const turned = (delta, word) => (delta === 0 ? "" : `${word} ${Math.abs(delta)}°`);

export const TEXT = {
  en: {
    title: "Endocrine system",
    hint: "← → turn",
    previous: "Previous view",
    next: "Next view",
    aria: "Model of the endocrine system in a half torso: left and right arrows turn it; it plays the stress response on a loop",
    viewName: (delta) => (delta === 0 ? "Front view" : `Turned ${delta < 0 ? "left" : "right"} ${Math.abs(delta)}°`),
    label: (delta) => `Classroom model of the endocrine system: the back half of a torso cut on the coronal plane, on a stand${turned(delta, delta < 0 ? ", turned left" : ", turned right")}. In the head the left half of the brain shows its medial face with the corpus callosum, the thalamus, the hypothalamus with the pituitary on its stalk, the pineal gland, the cerebellum and the brainstem, which runs on as the spinal cord with a sympathetic chain on each side. In the neck the thyroid wraps the trachea with four parathyroids behind; below come the thymus over the heart, the pancreas in the loop of the duodenum, both kidneys with an adrenal gland cut open on each, and the gonads in the pelvis. The aorta, the inferior vena cava, a carotid and a jugular, the hypophyseal portal vessels, the adrenal and splenic vessels, the vagus and the afferent nerve from the ear join them.`,
    keys: [
      { mark: "lit", label: "Lit: the glands and nerves acting at this moment" },
      { mark: "en-adr", label: "Adrenaline" },
      { mark: "en-hpa", label: "CRH and ACTH" },
      { mark: "en-cor", label: "Cortisol, and its brake on the hypothalamus and pituitary (blue rings)" },
      { mark: "en-sym", label: "Sympathetic nerves; the afferent nerve carries the alarm from the ear" },
    ],
    caption: "A classroom model of the endocrine system in the back half of a torso cut on the coronal plane. It plays the stress response from one model, on a loop: an alarm reaches the brain through the afferent nerve; within seconds the sympathetic nerves drive the adrenal medulla, adrenaline reaches the blood and the heart beats faster; over minutes CRH from the hypothalamus travels down the portal vessels to the anterior pituitary, ACTH reaches the adrenal cortex through the blood and cortisol rises, and cortisol in turn brakes the hypothalamus and the pituitary. The readout gives the model time and the step under way, and the bars below the stand give the normalised levels (0 to 1) of the model: the threat lasts 40 minutes and the loop covers 3 hours in 30 seconds.",
    levels: ["sympathetic", "adrenaline", "CRH", "ACTH", "cortisol"],
    live: {
      decimal: ".",
      phases: { perceive: "the brain perceives the threat", nerve: "sympathetic → adrenal medulla", adrenaline: "adrenaline · the heart speeds up", crh: "CRH → anterior pituitary", acth: "ACTH → adrenal cortex → cortisol", brake: "cortisol brakes CRH and ACTH", falling: "threat over · cortisol falls", rest: "back at rest" },
      rest: "t 0.0 s · the brain perceives the threat",
    },
  },
  es: {
    title: "Sistema endocrino",
    hint: "← → girar",
    previous: "Vista anterior",
    next: "Vista siguiente",
    aria: "Modelo del sistema endocrino en un medio torso: las flechas izquierda y derecha lo giran; reproduce la respuesta al estrés en bucle",
    viewName: (delta) => (delta === 0 ? "Vista de frente" : `Girado a la ${delta < 0 ? "izquierda" : "derecha"} ${Math.abs(delta)}°`),
    label: (delta) => `Modelo de aula del sistema endocrino: la mitad posterior de un torso cortado en el plano coronal, sobre un pie${turned(delta, delta < 0 ? ", girado a la izquierda" : ", girado a la derecha")}. En la cabeza, la mitad izquierda del encéfalo muestra su cara medial con el cuerpo calloso, el tálamo, el hipotálamo con la hipófisis en su tallo, la glándula pineal, el cerebelo y el tronco del encéfalo, que sigue como médula espinal con una cadena simpática a cada lado. En el cuello, la tiroides abraza la tráquea, con cuatro paratiroides detrás; más abajo están el timo sobre el corazón, el páncreas en el asa del duodeno, los dos riñones con una suprarrenal abierta en cada uno y las gónadas en la pelvis. La aorta, la vena cava inferior, una carótida y una yugular, los vasos porta hipofisarios, los vasos suprarrenales y esplénicos, el vago y el nervio aferente que viene del oído los unen.`,
    keys: [
      { mark: "lit", label: "Resaltado: las glándulas y los nervios que actúan en ese momento" },
      { mark: "en-adr", label: "Adrenalina" },
      { mark: "en-hpa", label: "CRH y ACTH" },
      { mark: "en-cor", label: "Cortisol, y su freno sobre el hipotálamo y la hipófisis (anillos azules)" },
      { mark: "en-sym", label: "Nervios simpáticos; el nervio aferente lleva la alarma desde el oído" },
    ],
    caption: "Un modelo de aula del sistema endocrino en la mitad posterior de un torso cortado en el plano coronal. Reproduce la respuesta al estrés a partir de un solo modelo, en bucle: una alarma llega al encéfalo por el nervio aferente; en segundos, los nervios simpáticos activan la médula suprarrenal, la adrenalina pasa a la sangre y el corazón late más rápido; en minutos, la CRH del hipotálamo baja por los vasos porta hasta la hipófisis anterior, la ACTH llega por la sangre a la corteza suprarrenal y sube el cortisol, que a su vez frena al hipotálamo y a la hipófisis. La lectura da el tiempo del modelo y el paso en curso, y las barras bajo el pie dan los niveles normalizados (de 0 a 1) del modelo: la amenaza dura 40 minutos y el bucle recorre 3 horas en 30 segundos.",
    levels: ["simpático", "adrenalina", "CRH", "ACTH", "cortisol"],
    live: {
      decimal: ",",
      phases: { perceive: "el encéfalo percibe la amenaza", nerve: "simpático → médula suprarrenal", adrenaline: "adrenalina · el corazón se acelera", crh: "CRH → hipófisis anterior", acth: "ACTH → corteza suprarrenal → cortisol", brake: "el cortisol frena CRH y ACTH", falling: "pasó la amenaza · baja el cortisol", rest: "de vuelta al reposo" },
      rest: "t 0,0 s · el encéfalo percibe la amenaza",
    },
  },
};
