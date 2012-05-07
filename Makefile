
all: build build-dev

build:
	@./node_modules/.bin/browserbuild \
		-g mydb \
		-m mydb -b lib/ \
		lib > dist/mydb.js
	@echo "... built dist/mydb.js"

build-dev:
	@./node_modules/.bin/browserbuild \
		-g mydb \
		-d -m mydb -b lib/ \
		lib > dist/mydb-dev.js
	@echo "... built dist/mydb-dev.js"
