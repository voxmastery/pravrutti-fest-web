import "server-only";

/**
 * Discoverize's WhatsApp group.
 *
 * Server-only on purpose. An invite link in a client component is an invite
 * link in the JavaScript bundle, readable by anyone who opens devtools on a
 * page they were never registered for — which is exactly the thing this is
 * not allowed to be. Importing it from a client component is a build error
 * rather than a quiet leak, which is why `server-only` is at the top.
 *
 * The QR is rendered from the same string on the way out, so there is no
 * image file sitting in public/ to be found by guessing its name either.
 */
export const DISCOVERIZE_WHATSAPP_URL = "https://chat.whatsapp.com/JwYELEQfM1M2FlXEyh8UJ1";

/**
 * The coordinators' own QR, not one we drew.
 *
 * Both encode the same invite, but theirs is the image they circulated — the
 * WhatsApp glyph in the middle is how a student recognises what they are
 * pointing a camera at, and a team that has seen it on a poster should meet
 * the same square here. Cropped from the screenshot they sent and reduced to
 * black and white, which the original already was, so nothing is lost: 1.7 KB.
 *
 * Inlined rather than written to public/, for the reason the URL is: a file
 * under public/ is served to anyone who guesses its name, and the QR IS the
 * invite — a photograph of it joins the group just as well as the link does.
 * A test asserts this image decodes to DISCOVERIZE_WHATSAPP_URL, so the two
 * can never drift into pointing at different groups.
 */
export const DISCOVERIZE_WHATSAPP_QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAFoAQAAAABSnlx4AAAGgElEQVR42u2bP4/kWBXFf8/2rL0s2jLSSmRb/gQwH2CFvSHfgHBCJBLCJfLrFcFmE0LGfAK0ESJ0EREOORJuEbAgwbqkWckNLh+CZ7v+tN1tz3TPds9WJeOxT99679137z33+JURCz4eZ/QZfUaf0Q8fjaSiu1yrMZJlVQOwUgO5qu5pKGnMdj35xWPoqL9oH9cK1ovQ0QJ0Rn1gvLjunZUkqVhLklQCkEq1kVhXvrs75Z3uKwCwEAAQn6Ph9dB2BL01xljYGg8grBAXCYBJS9gZY7LpfRKZUyc9gh37OOIyOL1hgAgDyTbG3G57Xfkt++x4tytYnyPtKM+5FWyHCCtutG2A8JsnujDJqgY22aKRlOfM9hroWjeiV5IsYBpyyzbGkJbbDxpyAG/gGce2PQ8yFzsZBB7Wdv69PXaaGRyiGP4J5q9JtnQFm4fhy+JkQNWQB7duRdeH6E3yl+5q556GU7b9FtmHtGODe7S9zJeBt2gkozs2mYA15di8130YbnvvPRGw+iZyUXjOVd9mL1Wu666XUgup655SVX4DrKuevHdsvazq0ewT3OeOfaTrfYez/MGnMZBvsu/FkBsTXwUu4sxHwDY+Rv/I1gC2fPJV1wEYly+9fwFVvWSWj7Xzqri/WZ7a3iRXwXERloHLmJ0Hm+QA7e/Fi7TsNYwaZFmpoZcyzrnqjtHtTE1JUhnWqEuAklR3d5ueMp6oFoFxnYB3up3ekV7KPJSRmAY2P679/5n80+SDf7/fqxZcmB/+80nbly5vT9OH/wbRZ0cahjcE66jXQruUUT9dhP5wEdosW8HyW+AQBfhCxbruCJ/7VHRc0W9JXPD06JZcPdXo0aFEqipUC9Pq7XTbcye1+IsljOPyV9l2/gq+gGr2SHZ2QqIZRb9yqWh83C5K7En9wutarubYl5IaOpcKnJxbSrW/T5LFUR482qDZU/ddMzpdgyi4Sj6ftYIerb9kxzbBfHRwgxg2mr/j+SwOqgTC8nc32y4GTS478dZxpK0kibUqX9JzFXoulVJlBi2jC78D28k+v312TctIJme50ZI18dpmAdo2bkDRDHRCQAurebaz18psf5qHPloRO4K+CjBsEscAB1YQyBHwnQdsowFdI/JiMBYEgPAbyIuVo4W38NhkLo/17rFym2aR7XYRW88Xs/X5FTDLYkz3sAasLV/ua1ooV6X8FtI2VPmxr40kkavCb8f5YJ8S4//sFqxJ9ApbzM1sBFMxOBZp3d05dacEjHWK5hzbbdf717PQKTw1mrcmFcCH77XRZB6s/LaX+vLnKiSpWenvGqrUpHe6DNHEI8F8Hf1HV9/qZIkOUcFfZ6Abl/bLbGYl8QAyUXxyu+0WLgahdMa4dzaj8eDXU+j2MHwtf+aL76PmoHYdaEppBRk8A8i/Vi8wxUaysf9bhl6Kjiia/kVxLvWSU20ku1bNtc7raBN9fG0E0x2MzKXFnx2XP+GXfDK3zpuC1dfxkhwb32VGnnngS11PS6dD6G8D/8aXLOvmdL1DtVhWFUZ8ORgKG8iLyhWr6V5qQSWJ71Uf1KKa9t9sPvoZvFww7hf96Ymbx12BYGej5lbVAtISp9eqNuo0JfJiVZuWfPSsxS0k4S0pZ3fZjT4cpbI6qFJGfd7Mu1yWquobLZ1yCO9at5+NKQBnxe9u0IfsIvvH9mf99e/hq/ZLfT4kpX3nlZaOFpZgNOiDBWGDbCrNUC2+896JphrcU3QL5bOaFntC6gsa9jTVeafpU7yAsDYidVpGH3/SiGphhn2QTXd1E+rtO3d+UItmaQ7+KOp5YHuqaPSpbq8IslINaffUrqWGnMnYiQGKI7dYe85sd4e+NO6TROBBchX10oI11skVB2+xhkAMpR1p0b09fonJZ9T585mzN0VHhxyjT1knVUqFe3Gf9mJuWHcdmCOJ01XKu+ak5Bw7b4guD6qU67zWla8W1nXoXFYb9ak3LQ7efNRDPTJA3QBFfFilshl155FF2n2e6x2ZZTGG3hnzCy7jnTHmNy9cAuQ9veKnm2zc9kedmZ/3beP7RPxhskoV59hZhL7WKV/0F5cJ8lp3XNDTmG2/hbQMJcmWq5pevRWpat6ts+W83dh5gyjuzt6urjzBunKvS7aRERcJ4ZU3Yduco+Et/rqqwolJctVprzDJurtzVDlvlu7zHTkRuOjsbXDz2dvokAAODw9+L2XOvwE+o8/oM/oRoP8PUgN0jfSnczoAAAAASUVORK5CYII=";
